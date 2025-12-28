const express = require("express");
const router = express.Router();
const { createAddress, getMyAddress } = require("../controllers/address");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth, createAddress);
router.get("/me", auth, getMyAddress);

module.exports = router;
