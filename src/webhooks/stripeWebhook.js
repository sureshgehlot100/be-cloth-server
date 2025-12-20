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

  console.log('✅ Received Stripe event:', event.type)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // Helpful debug: log session summary (avoid logging sensitive card data)
    console.log('Webhook session:', {
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      metadata: session.metadata,
      customer_details: session.customer_details && {
        email: session.customer_details.email
      }
    })

    try {
      if (!session.id) {
        console.error('Missing session.id — skipping order creation')
        return res.status(400).send('Missing session id')
      }

      const exists = await Order.findOne({ stripeSessionId: session.id })

      if (exists) {
        console.log('Order already exists for session:', session.id)
        return res.json({ received: true })
      }

      // Safely parse metadata.cartItems
      let items = []
      if (session.metadata && session.metadata.cartItems) {
        try {
          items = JSON.parse(session.metadata.cartItems)
        } catch (parseErr) {
          console.error('Failed to parse session.metadata.cartItems:', parseErr)
          items = []
        }
      }

      const orderData = {
        stripeSessionId: session.id,
        amount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency,
        paymentStatus: session.payment_status,
        items,
        customerEmail: session.customer_details && session.customer_details.email
      }

      await Order.create(orderData)
      console.log('Order saved for session:', session.id)
    } catch (err) {
      console.error('Order save failed:', err)
    }
  }

  res.json({ received: true })
}
