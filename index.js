const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const connectDB = require("./config/db");

const app = express();

// connect database
connectDB();

// middleware
app.use(cors()); //  CORS added

// ⚠️ Stripe webhook FIRST
// app.post(
//   '/api/webhook',
//   bodyParser.raw({ type: 'application/json' }),
//   require('./src/webhooks/stripeWebhook')
// )
app.use(express.json());

// routes
app.use("/api/checkout", require("./src/routes/checkout"));
app.use("/api/products", require("./src/routes/product"));

// test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
