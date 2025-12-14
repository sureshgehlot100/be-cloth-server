const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const Order = require('../models/Order')

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.log('❌ Webhook signature error:', err.message)
    return res.status(400).send('Webhook Error')
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    try {
      const exists = await Order.findOne({
        stripeSessionId: session.id
      })

      if (!exists) {
        await Order.create({
          stripeSessionId: session.id,
          amount: session.amount_total / 100,
          currency: session.currency,
          paymentStatus: session.payment_status,
          items: JSON.parse(session.metadata.cartItems),
          customerEmail: session.customer_details.email
        })
      }
    } catch (err) {
      console.error('Order save failed:', err)
    }
  }

  res.json({ received: true })
}
