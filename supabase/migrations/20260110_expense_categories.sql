-- ============================================
-- EXPENSE CATEGORIES TABLE
-- Dynamic categories that users can add/edit/delete
-- ============================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'tag',
  color TEXT DEFAULT '#f59e0b',
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique category names per user
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own categories"
  ON expense_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON expense_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON expense_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON expense_categories FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- VENDOR KEYWORDS TABLE
-- Auto-categorization based on vendor names
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  match_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique keywords per user
  UNIQUE(user_id, keyword)
);

-- Enable RLS
ALTER TABLE vendor_keywords ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own keywords"
  ON vendor_keywords FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keywords"
  ON vendor_keywords FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keywords"
  ON vendor_keywords FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keywords"
  ON vendor_keywords FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Insert default categories for new users
-- ============================================

CREATE OR REPLACE FUNCTION create_default_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_categories (user_id, name, icon, color, display_order, is_default) VALUES
    (NEW.id, 'Materials', 'package', '#3b82f6', 1, true),
    (NEW.id, 'Tools', 'wrench', '#8b5cf6', 2, true),
    (NEW.id, 'Fuel', 'fuel', '#ef4444', 3, true),
    (NEW.id, 'Vehicle', 'car', '#06b6d4', 4, true),
    (NEW.id, 'Insurance', 'shield', '#10b981', 5, true),
    (NEW.id, 'Subscriptions', 'credit-card', '#f59e0b', 6, true),
    (NEW.id, 'Office', 'briefcase', '#6366f1', 7, true),
    (NEW.id, 'Other', 'tag', '#64748b', 99, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create categories for new users
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_expense_categories();

-- ============================================
-- FUNCTION: Update category reference in expenses
-- When category is deleted, move expenses to 'Other'
-- ============================================

CREATE OR REPLACE FUNCTION handle_category_deletion()
RETURNS TRIGGER AS $$
DECLARE
  other_category_name TEXT := 'Other';
BEGIN
  -- Update expenses with the deleted category name to 'Other'
  UPDATE expenses
  SET category = other_category_name
  WHERE user_id = OLD.user_id AND category = OLD.name;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_category_deleted ON expense_categories;
CREATE TRIGGER on_category_deleted
  BEFORE DELETE ON expense_categories
  FOR EACH ROW
  WHEN (OLD.name != 'Other')
  EXECUTE FUNCTION handle_category_deletion();

-- ============================================
-- Insert default categories for existing users
-- ============================================

INSERT INTO expense_categories (user_id, name, icon, color, display_order, is_default)
SELECT
  u.id,
  cat.name,
  cat.icon,
  cat.color,
  cat.display_order,
  true
FROM auth.users u
CROSS JOIN (
  VALUES
    ('Materials', 'package', '#3b82f6', 1),
    ('Tools', 'wrench', '#8b5cf6', 2),
    ('Fuel', 'fuel', '#ef4444', 3),
    ('Vehicle', 'car', '#06b6d4', 4),
    ('Insurance', 'shield', '#10b981', 5),
    ('Subscriptions', 'credit-card', '#f59e0b', 6),
    ('Office', 'briefcase', '#6366f1', 7),
    ('Other', 'tag', '#64748b', 99)
) AS cat(name, icon, color, display_order)
ON CONFLICT (user_id, name) DO NOTHING;
