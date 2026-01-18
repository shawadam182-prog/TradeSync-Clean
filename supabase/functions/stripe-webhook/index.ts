import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Map price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SqhooGiHvsip9mT0mKie8Mm': 'professional',
  'price_1SqhqEGiHvsip9mTn0LulCGq': 'business',
  'price_1SqhrfGiHvsip9mT0nUZKsF0': 'enterprise',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get('STRIPE_WEBHOOK_SECRET')!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received event:', event.type);

    // Helper to update user settings
    async function updateUserSettings(
      stripeCustomerId: string,
      updates: Record<string, any>
    ) {
      const { error } = await supabaseAdmin
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', stripeCustomerId);

      if (error) {
        console.error('Error updating user settings:', error);
        throw error;
      }
    }

    // Helper to get tier from subscription
    function getTierFromSubscription(subscription: Stripe.Subscription): string {
      const priceId = subscription.items.data[0]?.price?.id;
      return PRICE_TO_TIER[priceId] || 'professional';
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (subscriptionId) {
          // Retrieve full subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const tier = getTierFromSubscription(subscription);

          await updateUserSettings(customerId, {
            stripe_subscription_id: subscriptionId,
            subscription_tier: tier,
            subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
            trial_end: subscription.trial_end && subscription.trial_end > 0
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            subscription_period_end: subscription.current_period_end && subscription.current_period_end > 0
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          });
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const tier = getTierFromSubscription(subscription);

        await updateUserSettings(customerId, {
          stripe_subscription_id: subscription.id,
          subscription_tier: tier,
          subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
          trial_end: subscription.trial_end && subscription.trial_end > 0
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          subscription_period_end: subscription.current_period_end && subscription.current_period_end > 0
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const tier = getTierFromSubscription(subscription);

        // Map Stripe status to our status
        let status = 'active';
        if (subscription.status === 'trialing') {
          status = 'trialing';
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        } else if (subscription.status === 'canceled') {
          status = 'cancelled';
        } else if (subscription.status === 'unpaid') {
          status = 'expired';
        }

        await updateUserSettings(customerId, {
          subscription_tier: tier,
          subscription_status: status,
          trial_end: subscription.trial_end && subscription.trial_end > 0
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          subscription_period_end: subscription.current_period_end && subscription.current_period_end > 0
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await updateUserSettings(customerId, {
          subscription_status: 'cancelled',
          subscription_tier: 'free',
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await updateUserSettings(customerId, {
          subscription_status: 'past_due',
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
