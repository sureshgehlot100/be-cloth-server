const Address = require("../models/Address");

const createAddress = async (req, res) => {
   
  try {
    
    const address = await Address.create({
      ...req.body,
      user: req.user._id,
    });

    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ message: "Address save failed" });
  }
};

const getMyAddress = async (req, res) => {
  const address = await Address.findOne({ user: req.user._id });
  res.json(address);
};

module.exports = { createAddress, getMyAddress };
