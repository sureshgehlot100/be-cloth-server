const express = require("express");
const { getOrderByuser } = require("../controllers/order");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", authMiddleware, getOrderByuser);

module.exports = router;
