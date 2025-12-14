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
  process.env.FRONTEND_URL,   // production frontend
  "http://localhost:3000"     // local dev
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
    credentials: true
  })
);

// preflight requests fix
app.options("*", cors());


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
