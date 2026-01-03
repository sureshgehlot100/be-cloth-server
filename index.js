const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const connectDB = require("./config/db");

const app = express();

// connect database
connectDB();

// middleware
const allowedOrigins = [
  process.env.FRONTEND_URL, // production frontend
  // 'http://localhost:3000',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ⚠️ Stripe webhook should be BEFORE express.json()
// (jab webhook enable karoge tab)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  require("./src/webhooks/stripeWebhook")
);

app.use(express.json());

// routes
app.use("/api/checkout", require("./src/routes/checkout"));
app.use("/api/products", require("./src/routes/product"));
app.use("/api/auth", require("./src/routes/user"));
app.use("/api/address", require("./src/routes/address"));
app.use('/api/order', require("./src/routes/order"));

// test route
app.get("/", (req, res) => {
  res.send("API is running on Vercel 🚀");
});

/**
 * ❌ REMOVE app.listen
 * ✅ EXPORT app
 */
// app.listen(5000, () => {
//   console.log(`Server listening on http://localhost:5000`);
// });
module.exports = app;
