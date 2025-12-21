// src/webhooks/stripeWebhook.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  // Debug: log presence and small preview of raw body and signature
  try {
    console.log('content-type:', req.headers['content-type']);
    console.log('stripe-signature present:', !!sig);
    if (req.body && Buffer.isBuffer(req.body)) {
      console.log('raw body length:', req.body.length);
      console.log('raw body preview:', req.body.toString('utf8').slice(0, 1000));
    } else {
      console.log('req.body is not a Buffer, typeof:', typeof req.body);
    }
    console.log('STRIPE_WEBHOOK_SECRET set:', !!process.env.STRIPE_WEBHOOK_SECRET);
  } catch (dbgErr) {
    console.error('Debug log failed:', dbgErr);
  }

  if (!sig) {
    console.error('No stripe-signature header present');
    return res.status(400).send('Missing signature header');
  }

  let event;
  try {
    // req.body should be a Buffer because you used express.raw on the route
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    // include message to help debug in logs; don't leak secret to client
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Received Stripe event:', event.type);

  try {
    // Handle checkout.session.completed (typical when using Checkout)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('session summary:', {
        id: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        customer_email: session.customer_details && session.customer_details.email
      });

      const exists = await Order.findOne({ stripeSessionId: session.id });
      if (exists) {
        console.log('Order already exists for session:', session.id);
        return res.json({ received: true });
      }

      // parse metadata safely
      let items = [];
      if (session.metadata && session.metadata.cartItems) {
        try { items = JSON.parse(session.metadata.cartItems) } catch(e){ items = [] }
      }

      await Order.create({
        stripeSessionId: session.id,
        amount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency,
        paymentStatus: session.payment_status,
        items,
        customerEmail: session.customer_details?.email
      });

      console.log('Order saved for checkout.session:', session.id);
    }

    // Handle payment_intent.succeeded (your posted event)
    else if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('payment_intent summary:', {
        id: pi.id,
        amount_received: pi.amount_received,
        currency: pi.currency,
        status: pi.status
      });

      // get charge data for billing details / email
      const charge = (pi.charges && pi.charges.data && pi.charges.data[0]) || null;
      const email = charge?.billing_details?.email || pi.receipt_email || null;

      // metadata might live on pi.metadata
      let items = [];
      if (pi.metadata && pi.metadata.cartItems) {
        try { items = JSON.parse(pi.metadata.cartItems) } catch(e){ items = [] }
      }

      // Avoid duplicate orders — use the payment intent id
      const exists = await Order.findOne({ stripeSessionId: pi.id });
      if (exists) {
        console.log('Order already exists for payment_intent:', pi.id);
        return res.json({ received: true });
      }

      await Order.create({
        stripeSessionId: pi.id,
        amount: (pi.amount_received || pi.amount) ? ( (pi.amount_received || pi.amount) / 100 ) : undefined,
        currency: pi.currency,
        paymentStatus: pi.status || 'succeeded',
        items,
        customerEmail: email
      });

      console.log('Order saved for payment_intent:', pi.id);
    }

    // other event types — log only
    else {
      console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('Order save failed:', err);
  }

  res.json({ received: true });
};
