const orderService = require('../services/orderService');
const { success, error } = require('../utils/apiResponse');

exports.getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    const order = await orderService.getOrderByNumber(orderNumber);
    
    return success(res, { order }, 'Order retrieved');
  } catch (err) {
    return error(res, err.message, 404);
  }
};
