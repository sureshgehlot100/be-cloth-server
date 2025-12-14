const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const connectDB = require("./config/db");

const app = express();

// connect database
connectDB();

// middleware
app.use(cors());

// ⚠️ Stripe webhook should be BEFORE express.json()
// (jab webhook enable karoge tab)
/// app.post(
//   "/api/webhook",
//   express.raw({ type: "application/json" }),
//   require("./src/webhooks/stripeWebhook")
// );

app.use(express.json());

// routes
app.use("/api/checkout", require("./src/routes/checkout"));
app.use("/api/products", require("./src/routes/product"));

// test route
app.get("/", (req, res) => {
  res.send("API is running on Vercel 🚀");
});

/**
 * ❌ REMOVE app.listen
 * ✅ EXPORT app
 */
module.exports = app;
