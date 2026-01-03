// src/webhooks/stripeWebhook.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const User = require('../models/User');

// safe JSON parser
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
    // 1) Preferred: checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      console.log('checkout.session.completed for session:', session.id, 'orderId:', orderId);
      console.log('session.metadata:', session.metadata);

      if (orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
          console.warn('No order draft found for orderId:', orderId);
        } else {
          // Avoid duplicate updates
          if (!order.stripeSessionId) order.stripeSessionId = session.id;
          if (session.metadata?.userId && !order.user) order.user = session.metadata.userId;

          order.paymentStatus = session.payment_status || 'paid';
          order.orderStatus = 'PLACED';

          // Prefer customer's email from our User record (if order.user set),
          // otherwise fall back to any existing order.customerEmail or Stripe session email.
          if (!order.customerEmail) {
            if (order.user) {
              const u = await User.findById(order.user).select('email');
              if (u) order.customerEmail = u.email;
            }
            if (!order.customerEmail && session.customer_details?.email) {
              order.customerEmail = session.customer_details.email;
            }
          }

          if (session.amount_total) order.amount = session.amount_total / 100;

          // If session.metadata had items snapshot (preferred: we keep items in DB draft),
          // we won't overwrite existing items. But if items are empty for some reason, try to parse.
          if ((!order.items || order.items.length === 0) && session.metadata?.cartItems) {
            const parsed = safeParseJSON(session.metadata.cartItems);
            order.items = Array.isArray(parsed) ? parsed : order.items;
          }

          await order.save();
          console.log('✅ Order updated from checkout.session:', order._id);

          // OPTIONAL: send confirmation email here (call async function, handle errors)
          // sendOrderConfirmationEmail(order);
        }
      } else {
        console.warn('No orderId in session.metadata', session.id);
      }
    }

    // 2) Fallback: payment_intent.succeeded
    else if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('payment_intent.succeeded id:', pi.id);

      // 2a) If PI has orderId in metadata (rare but possible)
      if (pi.metadata?.orderId) {
        const order = await Order.findById(pi.metadata.orderId);
        if (order && !order.paymentIntentId) {
          order.paymentIntentId = pi.id;
          if (pi.metadata?.userId && !order.user) order.user = pi.metadata.userId;
          order.paymentStatus = 'paid';
          order.orderStatus = 'PLACED';
          if (!order.customerEmail) {
            if (order.user) {
              const u = await User.findById(order.user).select('email');
              if (u) order.customerEmail = u.email;
            }
            if (!order.customerEmail && pi.receipt_email) order.customerEmail = pi.receipt_email;
          }
          if (pi.amount_received) order.amount = (pi.amount_received || pi.amount) / 100;
          await order.save();
          console.log('✅ Order updated from PI metadata:', order._id);
        }
      } else {
        // 2b) Try to find checkout session linked to this PI
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = sessions?.data?.[0] || null;
        if (session) {
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
              // prefer session id as stripeSessionId
              if (!order.stripeSessionId) order.stripeSessionId = session.id;
              if (session.metadata?.userId && !order.user) order.user = session.metadata.userId;

              order.paymentStatus = session.payment_status || 'paid';
              order.orderStatus = 'PLACED';
              if (!order.customerEmail) {
                if (order.user) {
                  const u = await User.findById(order.user).select('email');
                  if (u) order.customerEmail = u.email;
                }
                if (!order.customerEmail && session.customer_details?.email) order.customerEmail = session.customer_details.email;
              }
              if (session.amount_total) order.amount = session.amount_total / 100;
              await order.save();
              console.log('✅ Order updated using lookup session for PI:', order._id);
            }
          } else {
            console.warn('Found session for PI but no orderId in session.metadata', session.id);
          }
        } else {
          // 2c) Last resort: create fallback order keyed by paymentIntentId (do not mix with stripeSessionId)
          const exists = await Order.findOne({ paymentIntentId: pi.id });
          if (!exists) {
            let email = (pi.charges?.data?.[0]?.billing_details?.email) || pi.receipt_email || null;
            if (pi.metadata?.userId) {
              const u = await User.findById(pi.metadata.userId).select('email');
              if (u && u.email) email = u.email;
            }
            const created = await Order.create({
              paymentIntentId: pi.id,
              amount: (pi.amount_received || pi.amount) / 100,
              currency: pi.currency,
              paymentStatus: 'succeeded',
              orderStatus: 'PLACED',
              items: [],
                customerEmail: email
            });
            console.log('✅ Fallback order created for PI id:', pi.id, 'order:', created._id);
          } else {
            console.log('⚠️ Fallback order already exists for PI id:', pi.id);
          }
        }
      }
    }

    // 3) other events: log only
    else {
      console.log('Unhandled event type (logged only):', event.type);
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
  }

  // ack
  res.json({ received: true });
};
