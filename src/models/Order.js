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
  orderRef: { type: String, index: true },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    default: null
  },

  // snapshot of shipping address at time of order creation
  shipping: {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },

  amount: Number,
  currency: String,

  paymentStatus: {
    type: String,
    enum: ["PAID", "UNPAID", "PENDING"],
    default: "PENDING"
  },

  orderStatus: {
    type: String,
    enum: ["PENDING", "PLACED", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PENDING"
  },

  customerEmail: String,
  items: { type: [orderItemSchema], default: [] }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
