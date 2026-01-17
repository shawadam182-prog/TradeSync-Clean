import { supabase } from './supabase';

// Stripe Price IDs (Test Mode)
export const STRIPE_PRICES = {
  professional: 'price_1SqhooGiHvsip9mT0mKie8Mm',
  business: 'price_1SqhqEGiHvsip9mTn0LulCGq',
  enterprise: 'price_1SqhrfGiHvsip9mT0nUZKsF0',
} as const;

export type StripeTier = keyof typeof STRIPE_PRICES;

/**
 * Redirects the user to Stripe Checkout to subscribe to a plan.
 * @param tier - The subscription tier to subscribe to
 * @returns Promise that resolves when redirect starts, or rejects on error
 */
export async function redirectToCheckout(tier: StripeTier): Promise<void> {
  // Get the current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('You must be logged in to subscribe');
  }

  // Call the create-checkout edge function
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tier,
        successUrl: `${window.location.origin}/settings?checkout=success`,
        cancelUrl: `${window.location.origin}/settings?checkout=cancelled`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const { url } = await response.json();

  if (!url) {
    throw new Error('No checkout URL returned');
  }

  // Redirect to Stripe Checkout
  window.location.href = url;
}
