-- ============================================
-- VENDORS TABLE
-- Store vendor information for auto-fill and history tracking
-- ============================================

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_category TEXT,
  default_payment_method TEXT DEFAULT 'card',
  notes TEXT,
  total_spent DECIMAL(10,2) DEFAULT 0,
  expense_count INTEGER DEFAULT 0,
  last_expense_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique vendor names per user (case-insensitive)
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (in case of re-run)
DROP POLICY IF EXISTS "Users can view own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete own vendors" ON vendors;

-- RLS Policies
CREATE POLICY "Users can view own vendors"
  ON vendors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vendors"
  ON vendors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vendors"
  ON vendors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vendors"
  ON vendors FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup by name
CREATE INDEX IF NOT EXISTS idx_vendors_user_name ON vendors(user_id, name);
CREATE INDEX IF NOT EXISTS idx_vendors_total_spent ON vendors(user_id, total_spent DESC);

-- ============================================
-- FUNCTION: Update vendor stats when expense is added
-- ============================================

CREATE OR REPLACE FUNCTION update_vendor_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_vendor_id UUID;
  v_vendor_name TEXT;
BEGIN
  -- Get the vendor name from the expense
  v_vendor_name := COALESCE(NEW.vendor, '');

  IF v_vendor_name = '' THEN
    RETURN NEW;
  END IF;

  -- Try to find existing vendor or create new one
  SELECT id INTO v_vendor_id
  FROM vendors
  WHERE user_id = NEW.user_id AND LOWER(name) = LOWER(v_vendor_name);

  IF v_vendor_id IS NULL THEN
    -- Create new vendor
    INSERT INTO vendors (user_id, name, default_category, default_payment_method, total_spent, expense_count, last_expense_date)
    VALUES (
      NEW.user_id,
      v_vendor_name,
      NEW.category,
      NEW.payment_method,
      NEW.amount,
      1,
      NEW.expense_date::timestamptz
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
      total_spent = vendors.total_spent + EXCLUDED.total_spent,
      expense_count = vendors.expense_count + 1,
      last_expense_date = GREATEST(vendors.last_expense_date, EXCLUDED.last_expense_date),
      default_category = EXCLUDED.default_category,
      default_payment_method = EXCLUDED.default_payment_method,
      updated_at = NOW();
  ELSE
    -- Update existing vendor stats
    UPDATE vendors SET
      total_spent = total_spent + NEW.amount,
      expense_count = expense_count + 1,
      last_expense_date = GREATEST(last_expense_date, NEW.expense_date::timestamptz),
      default_category = NEW.category,
      default_payment_method = NEW.payment_method,
      updated_at = NOW()
    WHERE id = v_vendor_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Update vendor stats when expense is deleted
-- ============================================

CREATE OR REPLACE FUNCTION decrement_vendor_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vendors SET
    total_spent = GREATEST(0, total_spent - OLD.amount),
    expense_count = GREATEST(0, expense_count - 1),
    updated_at = NOW()
  WHERE user_id = OLD.user_id AND LOWER(name) = LOWER(OLD.vendor);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for expense changes
DROP TRIGGER IF EXISTS on_expense_created_update_vendor ON expenses;
CREATE TRIGGER on_expense_created_update_vendor
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_stats();

DROP TRIGGER IF EXISTS on_expense_deleted_update_vendor ON expenses;
CREATE TRIGGER on_expense_deleted_update_vendor
  AFTER DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION decrement_vendor_stats();

-- ============================================
-- Populate vendors from existing expenses
-- ============================================

INSERT INTO vendors (user_id, name, default_category, default_payment_method, total_spent, expense_count, last_expense_date)
SELECT
  user_id,
  vendor,
  (array_agg(category ORDER BY expense_date DESC))[1] as default_category,
  (array_agg(payment_method ORDER BY expense_date DESC))[1] as default_payment_method,
  SUM(amount) as total_spent,
  COUNT(*) as expense_count,
  MAX(expense_date) as last_expense_date
FROM expenses
WHERE vendor IS NOT NULL AND vendor != ''
GROUP BY user_id, vendor
ON CONFLICT (user_id, name) DO UPDATE SET
  total_spent = EXCLUDED.total_spent,
  expense_count = EXCLUDED.expense_count,
  last_expense_date = EXCLUDED.last_expense_date,
  updated_at = NOW();
