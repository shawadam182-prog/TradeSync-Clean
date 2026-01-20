# Database Migration Instructions

## How to Apply Migrations

To apply the database migrations in this directory to your Supabase project:

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the contents of the migration file you want to run
5. Paste it into the SQL editor
6. Click "Run" to execute the migration

### Option 2: Using Supabase CLI (If installed)

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Link your project
supabase link --project-ref YOUR_PROJECT_ID

# Run pending migrations
supabase db push
```

## Latest Migration

**File:** `20260120_fix_document_template_constraint.sql`

**Purpose:** Fixes the "Save Failed" error when saving invoice preferences

**Issue:** The database constraint only allowed 4 template types, but the app supports 8 templates. This caused a constraint violation error when users selected templates like 'trade-pro', 'compact', 'branded', 'statement', or 'modern-card'.

**Required:** Yes - This migration must be run to fix the invoice preferences save functionality.

---

## Migration History

- **20260119_bank_details_and_settings.sql** - Added bank details, document template, and tax year fields
- **20260117_part_payment_fields.sql** - Added part payment tracking fields
- **20260117_stripe_fields.sql** - Added Stripe payment integration fields
- **20260115_remove_expense_category_check.sql** - Removed expense category constraint
- **20260110_expense_categories_fix.sql** - Fixed expense categories
- **20260110_filing_cabinet.sql** - Added filing cabinet functionality
- **20260110_multi_reconciliation.sql** - Added multi-reconciliation support
- **20260110_payables.sql** - Added payables tracking
- **20260110_vendors.sql** - Added vendor management
- **20260110_expense_categories.sql** - Added expense categorization
- **002_expenses_and_vat.sql** - Added expenses and VAT tracking
- **001_initial_schema.sql** - Initial database schema
