-- Add invoice color scheme support and classic template
-- Part of the 3-template system with universal color schemes

-- Step 1: Drop existing constraints first
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_document_template_check;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_invoice_color_scheme_check;

-- Step 2: Add invoice_color_scheme column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS invoice_color_scheme TEXT DEFAULT 'default';

-- Step 3: Add constraint for 3 templates (professional, spacious, classic)
ALTER TABLE user_settings ADD CONSTRAINT user_settings_document_template_check CHECK (
  document_template IS NULL OR
  document_template IN ('professional', 'spacious', 'classic')
);

-- Step 4: Add constraint for color schemes
ALTER TABLE user_settings ADD CONSTRAINT user_settings_invoice_color_scheme_check CHECK (
  invoice_color_scheme IN ('default', 'slate', 'blue', 'teal', 'emerald', 'purple', 'rose')
);

-- Step 5: Update column comments
COMMENT ON COLUMN user_settings.document_template IS 'Document template style: professional (Zoho-style, default), spacious (larger text & spacing), classic (traditional)';
COMMENT ON COLUMN user_settings.invoice_color_scheme IS 'Invoice header color scheme: default (dark slate), slate, blue, teal, emerald, purple, rose';
