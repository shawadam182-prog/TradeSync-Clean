-- Fix document_template constraint to support all 8 template types
-- This migration resolves the error: "new row for relation user_settings violates check constraint user_settings_document_template_check"

-- Drop the existing constraint if it exists
ALTER TABLE user_settings
DROP CONSTRAINT IF EXISTS user_settings_document_template_check;

-- Add the correct constraint with all 8 valid template types
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_document_template_check
CHECK (document_template IS NULL OR document_template IN (
  'classic',      -- Traditional single-table, most compact
  'trade-pro',    -- Materials/Labour split (recommended)
  'minimal',      -- Clean, typography-focused
  'detailed',     -- Full breakdown with columns
  'compact',      -- Ultra-compact, one-page guarantee
  'branded',      -- Large logo focus
  'statement',    -- Zoho/QuickBooks style
  'modern-card'   -- Card-based app style
));

-- Update the default value to match the application default
ALTER TABLE user_settings
ALTER COLUMN document_template SET DEFAULT 'trade-pro';

-- Update the comment to reflect all valid values
COMMENT ON COLUMN user_settings.document_template IS 'Document template style: classic, trade-pro (default), minimal, detailed, compact, branded, statement, modern-card';
