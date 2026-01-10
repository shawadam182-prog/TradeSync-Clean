-- ============================================
-- PAYABLES TABLE
-- Track bills and invoices you need to pay to suppliers
-- ============================================

CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Supplier/Vendor info
  vendor_name TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,

  -- Bill details
  invoice_number TEXT,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) DEFAULT 0,

  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,

  -- Status
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'disputed')),
  amount_paid DECIMAL(10,2) DEFAULT 0,

  -- Categorization
  category TEXT DEFAULT 'materials',
  job_pack_id UUID REFERENCES job_packs(id) ON DELETE SET NULL,

  -- Document storage
  document_path TEXT,
  notes TEXT,

  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own payables" ON payables;
DROP POLICY IF EXISTS "Users can insert own payables" ON payables;
DROP POLICY IF EXISTS "Users can update own payables" ON payables;
DROP POLICY IF EXISTS "Users can delete own payables" ON payables;

-- RLS Policies
CREATE POLICY "Users can view own payables"
  ON payables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payables"
  ON payables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payables"
  ON payables FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payables"
  ON payables FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payables_user ON payables(user_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON payables(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payables_vendor ON payables(user_id, vendor_name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_payables_updated_at ON payables;
CREATE TRIGGER update_payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Auto-update status based on dates and payments
-- ============================================

CREATE OR REPLACE FUNCTION update_payable_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If fully paid
  IF NEW.amount_paid >= NEW.amount THEN
    NEW.status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := CURRENT_DATE;
    END IF;
  -- If partially paid
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'partial';
  -- If overdue and not paid
  ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('paid', 'disputed') THEN
    NEW.status := 'overdue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payable_update_status ON payables;
CREATE TRIGGER on_payable_update_status
  BEFORE INSERT OR UPDATE ON payables
  FOR EACH ROW
  EXECUTE FUNCTION update_payable_status();

-- ============================================
-- VIEW: Payables summary for dashboard
-- ============================================

CREATE OR REPLACE VIEW payables_summary AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_count,
  COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
  COUNT(*) FILTER (WHERE status = 'partial') as partial_count,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
  COALESCE(SUM(amount - amount_paid) FILTER (WHERE status IN ('unpaid', 'partial', 'overdue')), 0) as total_outstanding,
  COALESCE(SUM(amount - amount_paid) FILTER (WHERE status = 'overdue'), 0) as total_overdue,
  COALESCE(SUM(amount) FILTER (WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status NOT IN ('paid')), 0) as due_this_week
FROM payables
GROUP BY user_id;

-- ============================================
-- FUNCTION: Mark payable as paid
-- ============================================

CREATE OR REPLACE FUNCTION mark_payable_paid(
  p_payable_id UUID,
  p_paid_date DATE DEFAULT CURRENT_DATE,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE payables SET
    status = 'paid',
    amount_paid = amount,
    paid_date = p_paid_date,
    is_reconciled = (p_transaction_id IS NOT NULL),
    reconciled_transaction_id = p_transaction_id,
    updated_at = NOW()
  WHERE id = p_payable_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
