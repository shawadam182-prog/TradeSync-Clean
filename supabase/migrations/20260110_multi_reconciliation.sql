-- ============================================
-- MULTI-RECEIPT RECONCILIATION
-- Allow matching multiple expenses to one bank transaction
-- ============================================

-- Junction table for many-to-many reconciliation
CREATE TABLE IF NOT EXISTS reconciliation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  amount_matched DECIMAL(10,2), -- Portion of transaction matched to this expense/invoice
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either expense or invoice must be set
  CONSTRAINT expense_or_invoice CHECK (
    (expense_id IS NOT NULL AND invoice_id IS NULL) OR
    (expense_id IS NULL AND invoice_id IS NOT NULL)
  ),

  -- Prevent duplicate links
  UNIQUE(bank_transaction_id, expense_id),
  UNIQUE(bank_transaction_id, invoice_id)
);

-- Enable RLS
ALTER TABLE reconciliation_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own reconciliation links" ON reconciliation_links;
DROP POLICY IF EXISTS "Users can insert own reconciliation links" ON reconciliation_links;
DROP POLICY IF EXISTS "Users can delete own reconciliation links" ON reconciliation_links;

-- RLS Policies
CREATE POLICY "Users can view own reconciliation links"
  ON reconciliation_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reconciliation links"
  ON reconciliation_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reconciliation links"
  ON reconciliation_links FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_recon_links_transaction ON reconciliation_links(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recon_links_expense ON reconciliation_links(expense_id);
CREATE INDEX IF NOT EXISTS idx_recon_links_invoice ON reconciliation_links(invoice_id);

-- ============================================
-- VIEW: Reconciliation summary per transaction
-- ============================================

CREATE OR REPLACE VIEW reconciliation_summary AS
SELECT
  bt.id as transaction_id,
  bt.user_id,
  bt.transaction_date,
  bt.description,
  bt.amount as transaction_amount,
  bt.is_reconciled,
  COALESCE(SUM(rl.amount_matched), 0) as total_matched,
  ABS(bt.amount) - COALESCE(SUM(rl.amount_matched), 0) as unmatched_amount,
  COUNT(rl.id) as link_count,
  ARRAY_AGG(
    CASE
      WHEN rl.expense_id IS NOT NULL THEN 'expense:' || rl.expense_id::text
      WHEN rl.invoice_id IS NOT NULL THEN 'invoice:' || rl.invoice_id::text
    END
  ) FILTER (WHERE rl.id IS NOT NULL) as linked_items
FROM bank_transactions bt
LEFT JOIN reconciliation_links rl ON bt.id = rl.bank_transaction_id
GROUP BY bt.id, bt.user_id, bt.transaction_date, bt.description, bt.amount, bt.is_reconciled;

-- ============================================
-- FUNCTION: Multi-reconcile a transaction
-- ============================================

CREATE OR REPLACE FUNCTION reconcile_transaction_multi(
  p_transaction_id UUID,
  p_expense_ids UUID[],
  p_invoice_ids UUID[]
)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_expense_id UUID;
  v_invoice_id UUID;
  v_expense_amount DECIMAL(10,2);
  v_invoice_amount DECIMAL(10,2);
BEGIN
  -- Get user_id from transaction
  SELECT user_id INTO v_user_id FROM bank_transactions WHERE id = p_transaction_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Clear existing links for this transaction
  DELETE FROM reconciliation_links WHERE bank_transaction_id = p_transaction_id;

  -- Add expense links
  IF p_expense_ids IS NOT NULL THEN
    FOREACH v_expense_id IN ARRAY p_expense_ids
    LOOP
      SELECT amount INTO v_expense_amount FROM expenses WHERE id = v_expense_id;

      INSERT INTO reconciliation_links (user_id, bank_transaction_id, expense_id, amount_matched)
      VALUES (v_user_id, p_transaction_id, v_expense_id, v_expense_amount);

      -- Mark expense as reconciled
      UPDATE expenses SET is_reconciled = true, reconciled_transaction_id = p_transaction_id
      WHERE id = v_expense_id;
    END LOOP;
  END IF;

  -- Add invoice links
  IF p_invoice_ids IS NOT NULL THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      SELECT total INTO v_invoice_amount FROM quotes WHERE id = v_invoice_id;

      INSERT INTO reconciliation_links (user_id, bank_transaction_id, invoice_id, amount_matched)
      VALUES (v_user_id, p_transaction_id, v_invoice_id, v_invoice_amount);
    END LOOP;
  END IF;

  -- Mark transaction as reconciled
  UPDATE bank_transactions SET is_reconciled = true WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Unreconcile a transaction
-- ============================================

CREATE OR REPLACE FUNCTION unreconcile_transaction(p_transaction_id UUID)
RETURNS void AS $$
BEGIN
  -- Unmark linked expenses
  UPDATE expenses SET is_reconciled = false, reconciled_transaction_id = NULL
  WHERE reconciled_transaction_id = p_transaction_id;

  -- Remove links
  DELETE FROM reconciliation_links WHERE bank_transaction_id = p_transaction_id;

  -- Mark transaction as unreconciled
  UPDATE bank_transactions
  SET is_reconciled = false, reconciled_expense_id = NULL, reconciled_invoice_id = NULL
  WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
