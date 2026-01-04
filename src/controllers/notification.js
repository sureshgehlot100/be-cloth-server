const User = require("../models/User");
const { Expo } = require('expo-server-sdk');

const savePushToken = async (req, res) => {
  const { token, userId, deviceType, osName, osVersion } = req.body;
  if (!token || !userId) {
    return res.status(400).json({ message: "Missing token or userId" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // check if token already exists
    const existing = user.deviceTokens.find((t) => t.token === token);
    if (existing) {
      existing.deviceType = deviceType || existing.deviceType;
      existing.osName = osName || existing.osName;
      existing.osVersion = osVersion || existing.osVersion;
      existing.addedAt = Date.now();
    } else {
      user.deviceTokens.push({ token, deviceType, osName, osVersion });
    }

    await user.save();
    return res.status(200).json({ message: "Push token saved successfully" });
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/push-token/send
// body: { deviceToken, title, body, data }
const sendPushNotification = async (req, res) => {
  const { deviceToken, title, body, data } = req.body;
  if (!deviceToken || !title || !body) {
    return res.status(400).json({ message: "Missing deviceToken, title or body" });
  }

  try {
    const expo = new Expo();
    if (!Expo.isExpoPushToken(deviceToken)) {
      return res.status(400).json({ message: "Invalid Expo push token" });
    }

    const messages = [
      {
        to: deviceToken,
        sound: 'default',
        title,
        body,
        data: data || {}
      }
    ];

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }

    return res.status(200).json({ message: 'Notifications sent', tickets });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { savePushToken, sendPushNotification };