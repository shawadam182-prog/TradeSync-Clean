-- ============================================
-- Remove outdated CHECK constraint on expenses.category
-- Categories are now dynamic via expense_categories table
-- ============================================

-- Drop the old CHECK constraint that only allowed lowercase values
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Update any existing lowercase categories to match the new capitalized format
UPDATE expenses SET category = 'Materials' WHERE category = 'materials';
UPDATE expenses SET category = 'Tools' WHERE category = 'tools';
UPDATE expenses SET category = 'Fuel' WHERE category = 'fuel';
UPDATE expenses SET category = 'Subcontractor' WHERE category = 'subcontractor';
UPDATE expenses SET category = 'Office' WHERE category = 'office';
UPDATE expenses SET category = 'Insurance' WHERE category = 'insurance';
UPDATE expenses SET category = 'Other' WHERE category = 'other';
