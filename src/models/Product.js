const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    popularity: {
      type: Number,
      default: 0,
    },

    description: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
    },

    category: {
      type: String,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    dealType: {
      type: String,
      enum: ["CARD", "WEEKLY", "MONTHLY"],
      default: "CARD",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
