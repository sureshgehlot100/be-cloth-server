const express = require("express");
const { savePushToken, sendPushNotification } = require("../controllers/notification");
const router = express.Router();

router.post("/", savePushToken);
router.post("/send", sendPushNotification);

module.exports = router;