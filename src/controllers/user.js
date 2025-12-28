const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // 1️⃣ Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All required fields missing" });
    }

    // 2️⃣ Check user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword
    });

    // 5️⃣ Create JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ Send response
    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        name: user.firstName,
        email: user.email
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.firstName
    }
  });
};

module.exports = { createUser, loginUser };