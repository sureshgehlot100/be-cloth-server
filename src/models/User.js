const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String, required: true },
    deviceTokens: [
      {
        token: { type: String, required: true },
        deviceType: { type: String },
        osName: { type: String },
        osVersion: { type: String },
        addedAt: { type: Date, default: Date.now }
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
