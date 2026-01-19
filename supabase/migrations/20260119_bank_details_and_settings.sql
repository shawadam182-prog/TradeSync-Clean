-- Add bank details, document template, and tax year fields to user_settings table

-- Add bank details columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_sort_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Add document template field
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS document_template TEXT DEFAULT 'classic';

-- Add tax year start date fields (UK default is April 6)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS tax_year_start_month INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS tax_year_start_day INTEGER DEFAULT 6;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.bank_account_name IS 'Account holder name for bank payments';
COMMENT ON COLUMN user_settings.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN user_settings.bank_sort_code IS 'Bank sort code (UK format: 12-34-56)';
COMMENT ON COLUMN user_settings.bank_name IS 'Name of the bank';
COMMENT ON COLUMN user_settings.document_template IS 'Document template style: classic, modern, minimal, detailed';
COMMENT ON COLUMN user_settings.tax_year_start_month IS 'Tax year start month (1-12, UK default: 4 for April)';
COMMENT ON COLUMN user_settings.tax_year_start_day IS 'Tax year start day (1-31, UK default: 6)';
