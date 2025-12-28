// src/webhooks/stripeWebhook.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

async function safeParseJSON(str) {
  try { return JSON.parse(str); }
  catch (e) { return null; }
}

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('📩 Webhook hit');
  console.log('content-type:', req.headers['content-type']);
  console.log('stripe-signature present:', !!sig);
  console.log('STRIPE_WEBHOOK_SECRET set:', !!process.env.STRIPE_WEBHOOK_SECRET);

  if (!sig) {
    console.error('Missing stripe-signature header');
    return res.status(400).send('Missing signature header');
  }

  // Verify signature using raw body (req.body must be Buffer)
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Stripe event received:', event.type);

  try {
    // Helper: create order from session object (session from checkout)
    const createOrderFromSession = async (sessionObj) => {
      const sessionId = sessionObj.id;
      const exists = await Order.findOne({ stripeSessionId: sessionId });
      if (exists) {
        console.log('⚠️ Order already exists for session:', sessionId);
        return;
      }

      // sessionObj should have metadata.cartItems and customer_details
      let items = [];
      if (sessionObj.metadata && sessionObj.metadata.cartItems) {
        items = safeParseJSON(sessionObj.metadata.cartItems) || [];
      }

      const amount = sessionObj.amount_total ? sessionObj.amount_total / 100 : undefined;
      const email = sessionObj.customer_details?.email || sessionObj.customer_email || null;

      await Order.create({
        stripeSessionId: sessionId,
        amount,
        currency: sessionObj.currency,
        paymentStatus: sessionObj.payment_status || 'paid',
        items,
        customerEmail: email,
      });

      console.log('✅ Order saved for checkout.session:', sessionId);
    };

    // 1) If Checkout Session completed (preferred: contains metadata, customer_details)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('ℹ️ Handling checkout.session.completed', { id: session.id });
      await createOrderFromSession(session);
    }

    // 2) If PaymentIntent succeeded (sometimes fired by your integration)
    else if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('ℹ️ Handling payment_intent.succeeded', { id: pi.id, amount_received: pi.amount_received });

      // 2a) Check metadata on PI itself (if you explicitly set metadata there)
      if (pi.metadata && pi.metadata.cartItems) {
        console.log('Found metadata on PaymentIntent — using it');
        // create order using PI as id (use payment intent id as stripeSessionId)
        const exists = await Order.findOne({ stripeSessionId: pi.id });
        if (!exists) {
          const items = safeParseJSON(pi.metadata.cartItems) || [];
          const email = (pi.charges && pi.charges.data && pi.charges.data[0]?.billing_details?.email) || pi.receipt_email || null;
          await Order.create({
            stripeSessionId: pi.id,
            amount: (pi.amount_received || pi.amount) / 100,
            currency: pi.currency,
            paymentStatus: pi.status || 'succeeded',
            items,
            customerEmail: email,
          });
          console.log('✅ Order saved for payment_intent (metadata on PI):', pi.id);
        } else {
          console.log('⚠️ Order already exists for PI:', pi.id);
        }
      } else {
        // 2b) No metadata on PI: try to find checkout.session linked to this PI
        console.log('No metadata on PI — trying to find related Checkout Session');
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = (sessions && sessions.data && sessions.data[0]) || null;
        if (session) {
          console.log('Found Checkout Session for PI:', session.id);
          // Important: create order using checkout session id (preferred), so avoid duplicate keys
          // Check if order already exists for session.id
          const existsSession = await Order.findOne({ stripeSessionId: session.id });
          if (!existsSession) {
            let items = [];
            if (session.metadata && session.metadata.cartItems) items = safeParseJSON(session.metadata.cartItems) || [];
            const email = session.customer_details?.email || session.customer_email || null;
            const amount = session.amount_total ? session.amount_total / 100 : ((pi.amount_received || pi.amount) / 100);
            await Order.create({
              stripeSessionId: session.id,
              amount,
              currency: session.currency || pi.currency,
              paymentStatus: session.payment_status || pi.status || 'succeeded',
              items,
              customerEmail: email,
            });
            console.log('✅ Order saved using checkout.session found for PI:', session.id);
          } else {
            console.log('⚠️ Order already exists for found session:', session.id);
          }
        } else {
          console.log('❌ No checkout.session found for PI, creating order keyed by PI id');
          // fallback: create order keyed by payment intent id
          const existsPI = await Order.findOne({ stripeSessionId: pi.id });
          if (!existsPI) {
            const charge = (pi.charges && pi.charges.data && pi.charges.data[0]) || null;
            const email = charge?.billing_details?.email || pi.receipt_email || null;
            await Order.create({
              stripeSessionId: pi.id,
              amount: (pi.amount_received || pi.amount) / 100,
              currency: pi.currency,
              paymentStatus: pi.status || 'succeeded',
              items: [],
              customerEmail: email,
            });
            console.log('✅ Fallback order saved for PI id:', pi.id);
          } else {
            console.log('⚠️ Order already exists for PI id:', pi.id);
          }
        }
      }
    }

    // 3) other events: log only
    else {
      console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('❌ Webhook handler failed:', err);
  }

  // Acknowledge receipt
  res.json({ received: true });
};
