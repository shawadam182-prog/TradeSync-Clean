-- Add Stripe subscription fields to user_settings table

-- Add Stripe-related columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Create index on stripe_customer_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_stripe_customer_id
ON user_settings(stripe_customer_id);

-- Add comment for documentation
COMMENT ON COLUMN user_settings.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN user_settings.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx)';
COMMENT ON COLUMN user_settings.subscription_tier IS 'Current subscription tier: free, professional, business';
COMMENT ON COLUMN user_settings.subscription_status IS 'Subscription status: active, trialing, past_due, cancelled, expired';
COMMENT ON COLUMN user_settings.trial_end IS 'Trial period end timestamp';
COMMENT ON COLUMN user_settings.subscription_period_end IS 'Current billing period end timestamp';
