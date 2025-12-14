const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  stripeSessionId: {
    type: String,
    unique: true,
    required: true
  },
  amount: Number,
  currency: String,
  paymentStatus: String,
  customerEmail: String,
  items: Array
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)
