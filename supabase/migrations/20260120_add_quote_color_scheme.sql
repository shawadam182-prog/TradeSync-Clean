-- Add separate quote color scheme support
-- Allows quotes and invoices to have different color schemes

-- Step 1: Add quote_color_scheme column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS quote_color_scheme TEXT DEFAULT 'default';

-- Step 2: Add constraint for quote color schemes
ALTER TABLE user_settings ADD CONSTRAINT user_settings_quote_color_scheme_check CHECK (
  quote_color_scheme IN ('default', 'slate', 'blue', 'teal', 'emerald', 'purple', 'rose')
);

-- Step 3: Update column comment
COMMENT ON COLUMN user_settings.quote_color_scheme IS 'Quote header color scheme: default (dark slate), slate, blue, teal, emerald, purple, rose';
