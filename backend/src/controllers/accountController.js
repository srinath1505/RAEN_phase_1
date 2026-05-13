const prisma = require('../config/db');
const orderService = require('../services/orderService');
const { success, error } = require('../utils/apiResponse');

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await orderService.getUserOrders(userId);
    
    return success(res, { orders }, 'Orders retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: {
        isDefault: 'desc'
      }
    });
    
    return success(res, { addresses }, 'Addresses retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    
    // If this is the first address or marked as default, unset other defaults
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }
    
    const address = await prisma.address.create({
      data: {
        ...data,
        userId
      }
    });
    
    return success(res, { address }, 'Address created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = req.body;
    
    // Verify ownership
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });
    
    if (!existingAddress) {
      return error(res, 'Address not found', 404);
    }
    
    // If marked as default, unset other defaults
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, id: { not: id } },
        data: { isDefault: false }
      });
    }
    
    const address = await prisma.address.update({
      where: { id },
      data
    });
    
    return success(res, { address }, 'Address updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Verify ownership
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });
    
    if (!existingAddress) {
      return error(res, 'Address not found', 404);
    }
    
    await prisma.address.delete({
      where: { id }
    });
    
    return success(res, null, 'Address deleted');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
