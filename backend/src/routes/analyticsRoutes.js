const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');

router.post('/pageview', ctrl.trackPageView);
router.post('/cart-event', ctrl.trackCartEvent);

module.exports = router;
