// src/controllers/checkout.js
const Product = require('../models/Product');
const Order = require('../models/Order');
const Address = require('../models/Address');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const checkoutsession = async (req, res) => {
  try {
    const { cartItems } = req.body;
    

    if (!cartItems || !cartItems.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Fetch products to validate and get fresh prices
    const products = await Product.find({
      _id: { $in: cartItems.map(i => i.productId) }
    });

    if (products.length !== cartItems.length) {
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    // Build normalized items array for DB (remove large fields)
    const normalizedItems = cartItems.map(item => {
      const product = products.find(p => p._id.toString() === item.productId);
      return {
        productId: product._id.toString(),
        name: product.name,
        price: Number(product.price),
        quantity: Number(item.quantity) || 1
      };
    });

    // Compute amounts server-side
    const amount = normalizedItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const currency = 'gbp';

    // Determine address: prefer provided addressId, otherwise use user's saved address
    let addressId = req.body.addressId || null;
    let addressDoc = null;
    if (addressId) {
      addressDoc = await Address.findById(addressId);
      if (!addressDoc) addressId = null;
    }
    if (!addressId && req.user) {
      addressDoc = await Address.findOne({ user: req.user._id });
      if (addressDoc) addressId = addressDoc._id;
    }

    const shippingSnapshot = addressDoc
      ? {
          fullName: addressDoc.fullName,
          phone: addressDoc.phone,
          addressLine1: addressDoc.addressLine1,
          addressLine2: addressDoc.addressLine2,
          city: addressDoc.city,
          state: addressDoc.state,
          postalCode: addressDoc.postalCode,
          country: addressDoc.country
        }
      : null;

    // Create order draft in DB (pending) with shipping snapshot and user email
    const orderDraft = await Order.create({
      orderRef: undefined,
      amount,
      currency,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      items: normalizedItems,
      user: req.user?._id || null,
      address: addressId || null,
      shipping: shippingSnapshot,
      customerEmail: req.user?.email || null
    });

    // Save orderRef = string of _id for convenience
    orderDraft.orderRef = orderDraft._id.toString();
    await orderDraft.save();

    // Create Stripe line items
    const line_items = normalizedItems.map(it => ({
      price_data: {
        currency,
        product_data: { name: it.name },
        unit_amount: Math.round(it.price * 100)
      },
      quantity: it.quantity
    }));

    // Create Checkout Session with only orderId metadata (tiny)
    console.log('Creating checkout session, req.user:', req.user && req.user._id);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/failed`,
      metadata: {
        orderId: orderDraft._id.toString(),
        userId: req.user._id.toString()
      }
    });

    // Return checkout url to frontend
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkout Error:', err);
    res.status(500).json({ message: 'Checkout session creation failed' });
  }
};

const verifypayment = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ success: false });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('🔎 verify session payment_status:', session.payment_status);

    if (session.payment_status === 'paid' || session.payment_status === 'complete') {
      return res.json({ success: true });
    }
    res.json({ success: false });
  } catch (err) {
    console.error('❌ Verify Error:', err);
    res.status(500).json({ success: false });
  }
};

module.exports = { checkoutsession, verifypayment };
