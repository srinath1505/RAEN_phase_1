const prisma = require('../config/db');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const { success, error } = require('../utils/apiResponse');

// Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalOrders = await prisma.order.count();
    const totalRevenue = await prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { total: true }
    });
    const pendingOrders = await prisma.order.count({
      where: { status: 'PENDING' }
    });
    const pendingVerifications = await prisma.payment.count({
      where: { status: 'VERIFICATION_REQUIRED' }
    });
    
    return success(res, {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
      pendingVerifications
    }, 'Dashboard data retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { products }, 'Products retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.createProduct = async (req, res) => {
  try {
    const data = req.body;
    
    const product = await prisma.product.create({
      data
    });
    
    return success(res, { product }, 'Product created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const product = await prisma.product.update({
      where: { id },
      data
    });
    
    return success(res, { product }, 'Product updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.product.delete({
      where: { id }
    });
    
    return success(res, null, 'Product deleted');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { orders }, 'Orders retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);
    
    return success(res, { order }, 'Order retrieved');
  } catch (err) {
    return error(res, err.message, 404);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = await orderService.updateOrderStatus(id, status);
    
    return success(res, { order }, 'Order status updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Inventory
exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: {
        product: true
      },
      orderBy: {
        stock: 'asc'
      }
    });
    
    return success(res, { inventory }, 'Inventory retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    
    const inventoryItem = await prisma.inventory.update({
      where: { id },
      data: { stock }
    });
    
    return success(res, { inventoryItem }, 'Inventory updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Customers
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            orders: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { customers }, 'Customers retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        order: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { payments }, 'Payments retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getPendingVerifications = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'VERIFICATION_REQUIRED'
      },
      include: {
        order: {
          include: {
            items: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { payments }, 'Pending verifications retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    await paymentService.approveUpiPayment(id, null, null);
    
    return success(res, null, 'Payment approved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    await paymentService.rejectUpiPayment(id);
    
    return success(res, null, 'Payment rejected');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Early Access
exports.getAllEarlyAccess = async (req, res) => {
  try {
    const requests = await prisma.earlyAccessRequest.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { requests }, 'Early access requests retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateEarlyAccessStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const request = await prisma.earlyAccessRequest.update({
      where: { id },
      data: { status }
    });
    
    return success(res, { request }, 'Early access status updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Contact Messages
exports.getAllContactMessages = async (req, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return success(res, { messages }, 'Contact messages retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateContactMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const message = await prisma.contactMessage.update({
      where: { id },
      data: { status }
    });
    
    return success(res, { message }, 'Contact message status updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
