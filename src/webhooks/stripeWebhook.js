const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");

module.exports = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  console.log("📩 Stripe Webhook hit");
  console.log("Signature present:", !!sig);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  console.log("✅ Event received:", event.type);

  // 🔥 MAIN EVENT FOR CHECKOUT FLOW
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;

    console.log("💰 PaymentIntent:", pi.id);

    try {
      const alreadyExists = await Order.findOne({
        stripeSessionId: pi.id,
      });

      if (alreadyExists) {
        console.log("⚠️ Order already exists");
        return res.json({ received: true });
      }

      const items = pi.metadata?.cartItems
        ? JSON.parse(pi.metadata.cartItems)
        : [];

      await Order.create({
        stripeSessionId: pi.id,
        amount: pi.amount_received / 100,
        currency: pi.currency,
        paymentStatus: pi.status,
        items,
        customerEmail: pi.receipt_email,
      });

      console.log("✅ Order saved successfully");
    } catch (err) {
      console.error("❌ Order save error:", err);
    }
  }

  res.json({ received: true });
};
