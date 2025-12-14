const express = require('express');
const { checkoutsession, verifypayment } = require('../controllers/checkout');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Checkout route is working' });
});
router.post('/',checkoutsession);

router.get('/verify', verifypayment);

module.exports = router;