const Product = require("../models/Product");

// GET ALL PRODUCTS
const getProduct = async (req, res) => {
  try {
    const response = await Product.find();
    res.status(200).json({
      message: "Products fetched successfully",
      response,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET PRODUCT BY ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ADD PRODUCT
const addProduct = async (req, res) => {
  try {
   
    const {  name,category,popularity,dealType,price,rating,description,image,date } = req.body;

    const newProduct = new Product({
      name,category,popularity,dealType,price,rating,description,image,date
    });
    await newProduct.save();

    res.status(201).json({
      message: "Product added successfully",
      product: newProduct,
    });
  } catch (error) {
    console.log*(error);
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE PRODUCT BY ID
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE ALL PRODUCTS
const deleteAllProducts = async (req, res) => {
  try {
    await Product.deleteMany({});
    res.status(200).json({ message: "All products deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, size, image, desc, category } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { name, price, size, image, desc, category },
      { new: true }
    );

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getProduct,
  getProductById,
  addProduct,
  deleteProduct,
  deleteAllProducts,
  updateProduct,
};
