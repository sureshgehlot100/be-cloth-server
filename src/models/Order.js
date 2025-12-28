// models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String },
  name: { type: String },
  price: { type: Number },
  quantity: { type: Number, default: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  stripeSessionId: { type: String, unique: true, sparse: true },
  orderRef: { type: String, index: true }, // our local order id string (same as _id)
  amount: Number,
  currency: String,
  paymentStatus: String,     // paid / unpaid / pending
  orderStatus: {             // business status
    type: String,
    default: 'PENDING'       // PENDING -> PLACED -> SHIPPED -> DELIVERED etc.
  },
  customerEmail: String,
  items: { type: [orderItemSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
