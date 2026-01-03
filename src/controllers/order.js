const Order = require("../models/Order");

const getOrderByuser = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

module.exports = { getOrderByuser };
