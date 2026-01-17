-- Add part payment fields to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS part_payment_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS part_payment_type TEXT CHECK (part_payment_type IS NULL OR part_payment_type IN ('percentage', 'fixed'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS part_payment_value NUMERIC;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS part_payment_label TEXT;

-- Also add discount fields if they don't exist (they were in types but not in DB)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_description TEXT;

-- Add job_address field if it doesn't exist
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_address TEXT;
