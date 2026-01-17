import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  professional: 'price_1SqhooGiHvsip9mT0mKie8Mm',
  business: 'price_1SqhqEGiHvsip9mTn0LulCGq',
  enterprise: 'price_1SqhrfGiHvsip9mT0nUZKsF0',
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { tier, successUrl, cancelUrl } = await req.json();

    if (!tier || !PRICE_IDS[tier]) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let stripeCustomerId = settings?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Store customer ID in user_settings
      const { error: updateError } = await supabaseAdmin
        .from('user_settings')
        .upsert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (updateError) {
        console.error('Error storing customer ID:', updateError);
      }
    }

    // Create checkout session with 14-day trial
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[tier],
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
          tier: tier,
        },
      },
      success_url: successUrl || `${req.headers.get('origin')}/settings?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/settings?checkout=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        tier: tier,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
