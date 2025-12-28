// src/webhooks/stripeWebhook.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('📩 Webhook hit, signature present:', !!sig);

  if (!sig) return res.status(400).send('Missing signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Stripe event:', event.type);

  try {
    // Preferred: checkout.session.completed (session has metadata.orderId)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      console.log('checkout.session.completed for session:', session.id, 'orderId:', orderId);

      if (orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
          console.warn('No order draft found for orderId:', orderId);
        } else {
          // Avoid duplicate if stripeSessionId already set
          if (!order.stripeSessionId) order.stripeSessionId = session.id;
          order.paymentStatus = session.payment_status || 'paid';
          order.orderStatus = 'PLACED';
          order.customerEmail = session.customer_details?.email || order.customerEmail;
          // Update amount if needed
          if (session.amount_total) order.amount = session.amount_total / 100;
          await order.save();
          console.log('✅ Order updated from checkout.session:', order._id);
        }
      } else {
        console.warn('No orderId in session.metadata', session.id);
      }
    }

    // Fallback: payment_intent.succeeded (if you receive PI events)
    else if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('payment_intent.succeeded id:', pi.id);

      // Try to find orderId from the PI metadata
      if (pi.metadata?.orderId) {
        const order = await Order.findById(pi.metadata.orderId);
        if (order && !order.stripeSessionId) {
          order.stripeSessionId = pi.id;
          order.paymentStatus = 'paid';
          order.orderStatus = 'PLACED';
          order.customerEmail = pi.receipt_email || order.customerEmail;
          if (pi.amount_received) order.amount = (pi.amount_received || pi.amount) / 100;
          await order.save();
          console.log('✅ Order updated from PI metadata:', order._id);
        }
      } else {
        // Try to find a checkout session linked to this PI
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = sessions?.data?.[0] || null;
        if (session) {
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
              order.stripeSessionId = session.id;
              order.paymentStatus = session.payment_status || 'paid';
              order.orderStatus = 'PLACED';
              order.customerEmail = session.customer_details?.email || order.customerEmail;
              if (session.amount_total) order.amount = session.amount_total / 100;
              await order.save();
              console.log('✅ Order updated using lookup session for PI:', order._id);
            }
          }
        } else {
          // last resort: create fallback order keyed by PI id
          const exists = await Order.findOne({ stripeSessionId: pi.id });
          if (!exists) {
            const email = (pi.charges?.data?.[0]?.billing_details?.email) || pi.receipt_email || null;
            await Order.create({
              stripeSessionId: pi.id,
              amount: (pi.amount_received || pi.amount) / 100,
              currency: pi.currency,
              paymentStatus: 'succeeded',
              orderStatus: 'PLACED',
              items: [],
              customerEmail: email
            });
            console.log('✅ Fallback order created for PI id:', pi.id);
          }
        }
      }
    }

    else {
      console.log('Unhandled event type (logged only):', event.type);
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
  }

  res.json({ received: true });
};
