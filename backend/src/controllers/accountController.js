const prisma = require('../config/db');
const orderService = require('../services/orderService');
const { success, error } = require('../utils/apiResponse');

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true }
    });
    if (!user) return error(res, 'User not found', 404);
    return success(res, { user }, 'Profile retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const data = {};
    if (firstName !== undefined) data.firstName = firstName.trim();
    if (lastName !== undefined) data.lastName = lastName.trim();
    if (phone !== undefined) data.phone = phone ? phone.trim() : null;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true }
    });
    return success(res, { user }, 'Profile updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

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
