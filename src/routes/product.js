const express =require('express');
const { getProduct, getProductById, updateProduct, addProduct, deleteProduct, deleteAllProducts } = require('../controllers/product');
const router = express.Router();


router.get("/",getProduct);
router.get("/:id",getProductById);
router.patch("/:id",updateProduct);
router.post("/",addProduct);
router.delete("/:id",deleteProduct);
router.delete("/",deleteAllProducts);


module.exports = router;