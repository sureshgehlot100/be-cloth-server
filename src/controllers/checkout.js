const Product = require("../models/Product");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const checkoutsession = async (req, res) => {
  try {
    const { cartItems } = req.body;
    console.log(cartItems);
    // ❌ Validation
    if (!cartItems || !cartItems.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // ✅ Fetch products from DB (price source of truth)
    const products = await Product.find({
      _id: { $in: cartItems.map(item => item.productId) }
    });

    console.log(products);

    // ❌ If product mismatch
    if (products.length !== cartItems.length) {
      return res.status(400).json({ message: "Invalid cart items" });
    }

    // ✅ Create Stripe line items
    const line_items = cartItems.map(item => {
      const product = products.find(
        p => p._id.toString() === item.productId
      );

      return {
        price_data: {
          currency: "gbp", // change if needed
          product_data: {
            name: product.name,
            images: [product.image], // optional
          },
          unit_amount: Math.round(product.price * 100), // pence
        },
        quantity: item.quantity,
      };
    });

    // ✅ Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/failed`,
    });

    // ✅ Send Stripe URL to frontend
    res.status(200).json({
      url: session.url,
    });

  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({
      message: "Checkout session creation failed",
    });
  }
};

const verifypayment = async (req, res) => {
    try {
    const { session_id } = req.query
   console.log(session_id);
    if (!session_id) {
      return res.status(400).json({ success: false })
    }

    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status === 'paid') {
      return res.json({
        success: true,
        session
      })
       //  IMPORTANT
    //   metadata: {
    //     cartItems: JSON.stringify(cartItems)
    //   }
    }

    res.json({ success: false })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false })
  }
}

module.exports = { checkoutsession, verifypayment };
