-- ============================================
-- FILING CABINET
-- Centralized document storage for all business documents
-- ============================================

CREATE TABLE IF NOT EXISTS filed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Document metadata
  name TEXT NOT NULL,
  description TEXT,
  file_type TEXT, -- pdf, jpg, png, etc.
  file_size INTEGER, -- bytes
  storage_path TEXT NOT NULL,

  -- Categorization
  category TEXT DEFAULT 'general' CHECK (category IN (
    'receipt', 'invoice', 'contract', 'certificate',
    'insurance', 'warranty', 'tax', 'bank', 'general'
  )),
  tags TEXT[], -- Array of custom tags

  -- Dates
  document_date DATE, -- Date on the document (e.g., invoice date)
  expiry_date DATE, -- For certificates, warranties, insurance

  -- Relationships
  vendor_name TEXT,
  job_pack_id UUID REFERENCES job_packs(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  payable_id UUID REFERENCES payables(id) ON DELETE SET NULL,

  -- Search optimization
  extracted_text TEXT, -- OCR text for searching

  -- Tax year tracking
  tax_year TEXT, -- e.g., "2024-2025"

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE filed_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own documents" ON filed_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON filed_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON filed_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON filed_documents;

-- RLS Policies
CREATE POLICY "Users can view own documents"
  ON filed_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON filed_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON filed_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON filed_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_filed_docs_user ON filed_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_filed_docs_category ON filed_documents(user_id, category);
CREATE INDEX IF NOT EXISTS idx_filed_docs_date ON filed_documents(user_id, document_date);
CREATE INDEX IF NOT EXISTS idx_filed_docs_tax_year ON filed_documents(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_filed_docs_expiry ON filed_documents(user_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_filed_docs_tags ON filed_documents USING GIN(tags);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_filed_docs_search ON filed_documents
  USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(extracted_text, '')));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_filed_documents_updated_at ON filed_documents;
CREATE TRIGGER update_filed_documents_updated_at
  BEFORE UPDATE ON filed_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Storage bucket for filed documents
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('filed-documents', 'filed-documents', false, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload filed documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view filed documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete filed documents" ON storage.objects;

CREATE POLICY "Users can upload filed documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'filed-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view filed documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'filed-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete filed documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'filed-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- VIEW: Documents summary by category
-- ============================================

CREATE OR REPLACE VIEW filing_summary AS
SELECT
  user_id,
  category,
  COUNT(*) as document_count,
  COALESCE(SUM(file_size), 0) as total_size,
  MAX(created_at) as last_upload
FROM filed_documents
GROUP BY user_id, category;

-- ============================================
-- VIEW: Expiring documents (next 30 days)
-- ============================================

CREATE OR REPLACE VIEW expiring_documents AS
SELECT *
FROM filed_documents
WHERE expiry_date IS NOT NULL
  AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY expiry_date;

-- ============================================
-- FUNCTION: Full text search
-- ============================================

CREATE OR REPLACE FUNCTION search_filed_documents(
  p_user_id UUID,
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_tax_year TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  document_date DATE,
  storage_path TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fd.id,
    fd.name,
    fd.description,
    fd.category,
    fd.document_date,
    fd.storage_path,
    ts_rank(
      to_tsvector('english', COALESCE(fd.name, '') || ' ' || COALESCE(fd.description, '') || ' ' || COALESCE(fd.extracted_text, '')),
      plainto_tsquery('english', p_query)
    ) as rank
  FROM filed_documents fd
  WHERE fd.user_id = p_user_id
    AND (p_category IS NULL OR fd.category = p_category)
    AND (p_tax_year IS NULL OR fd.tax_year = p_tax_year)
    AND (
      p_query IS NULL OR
      to_tsvector('english', COALESCE(fd.name, '') || ' ' || COALESCE(fd.description, '') || ' ' || COALESCE(fd.extracted_text, ''))
      @@ plainto_tsquery('english', p_query)
    )
  ORDER BY rank DESC, fd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
