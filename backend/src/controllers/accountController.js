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

    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return error(res, 'Address not found', 404);
    }

    await prisma.address.delete({ where: { id } });

    return success(res, null, 'Address deleted');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Ownership check: customer can only cancel their own orders
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: { payments: true, items: true }
    });

    if (!order) return error(res, 'Order not found', 404);

    if (!['PENDING', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
      return error(res, `Cannot cancel order with status ${order.status}`, 400);
    }

    const hoursSinceOrder = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    if (hoursSinceOrder > 48) {
      return error(res, 'Orders can only be cancelled within 48 hours of placement', 400);
    }

    const finalPaymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED', paymentStatus: finalPaymentStatus }
      });

      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, size: item.size },
          data: { stock: { increment: item.quantity } }
        });
      }

      const payment = order.payments?.[0] || null;
      if (payment?.status === 'SUCCESS') {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      }

      // Log as CUSTOMER_CANCEL for admin visibility — adminUserId FK accepts any User.id
      await tx.adminAuditLog.create({
        data: {
          adminUserId: userId,
          action: 'CUSTOMER_CANCEL',
          entityType: 'Order',
          entityId: id,
          metadata: { previousStatus: order.status, cancelledBy: 'customer' }
        }
      });
    });

    // Non-blocking gateway refund
    const payment = order.payments?.[0] || null;
    if (payment?.status === 'SUCCESS' && payment.providerPaymentId) {
      const razorpayService = require('../services/razorpayService');
      const paypalService = require('../services/paypalService');
      if (payment.provider === 'RAZORPAY') {
        razorpayService.refundPayment(payment.providerPaymentId)
          .catch(err => console.error('Customer cancel: Razorpay refund error:', err.message));
      } else if (payment.provider === 'PAYPAL') {
        paypalService.refundPayment(payment.providerPaymentId)
          .catch(err => console.error('Customer cancel: PayPal refund error:', err.message));
      }
    }

    // Non-blocking cancellation email
    const emailService = require('../services/emailService');
    emailService.sendOrderCancellation({
      email: order.email,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentStatus: finalPaymentStatus
    }).catch(err => console.error('Customer cancel: email error:', err.message));

    return success(res, null, 'Order cancelled successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getMeasurements = async (req, res) => {
  try {
    const userId = req.user.id;
    const record = await prisma.userMeasurements.findUnique({ where: { userId } });
    return success(res, { measurements: record || null }, 'Measurements retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.saveMeasurements = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bust, waist, hip, shoulderToFloor } = req.body;
    const data = {
      bust: bust !== undefined ? parseFloat(bust) || null : undefined,
      waist: waist !== undefined ? parseFloat(waist) || null : undefined,
      hip: hip !== undefined ? parseFloat(hip) || null : undefined,
      shoulderToFloor: shoulderToFloor !== undefined ? parseFloat(shoulderToFloor) || null : undefined
    };
    const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const record = await prisma.userMeasurements.upsert({
      where: { userId },
      create: { userId, ...cleaned },
      update: cleaned
    });
    return success(res, { measurements: record }, 'Measurements saved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
