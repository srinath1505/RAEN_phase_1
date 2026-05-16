const prisma = require('../config/db');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const razorpayService = require('../services/razorpayService');
const paypalService = require('../services/paypalService');
const emailService = require('../services/emailService');
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
    const { name, description, category, price, salePrice, discountPercent, status, images, sizes } = req.body;
    const slug = req.body.slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        category,
        price: parseFloat(price),
        salePrice: salePrice ? parseFloat(salePrice) : null,
        discountPercent: discountPercent ? parseInt(discountPercent) : null,
        status: status || 'ACTIVE',
        images: images || [],
        sizes: sizes || ['XS', 'S', 'M', 'L']
      }
    });

    const productSizes = sizes || ['XS', 'S', 'M', 'L'];
    for (const size of productSizes) {
      await prisma.inventory.upsert({
        where: { productId_size: { productId: product.id, size } },
        update: {},
        create: { productId: product.id, size, stock: 10, sku: `${slug}-${size}`.toUpperCase() }
      });
    }

    await prisma.adminAuditLog.create({
      data: { adminUserId: req.user.id, action: 'CREATE_PRODUCT', entityType: 'Product', entityId: product.id }
    });

    return success(res, { product }, 'Product created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, salePrice, discountPercent, status, images, sizes } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = parseFloat(price);
    if (salePrice !== undefined) data.salePrice = salePrice ? parseFloat(salePrice) : null;
    if (discountPercent !== undefined) data.discountPercent = discountPercent ? parseInt(discountPercent) : null;
    if (status !== undefined) data.status = status;
    if (images !== undefined) data.images = images;
    if (sizes !== undefined) data.sizes = sizes;

    const product = await prisma.product.update({ where: { id }, data });

    await prisma.adminAuditLog.create({
      data: { adminUserId: req.user.id, action: 'UPDATE_PRODUCT', entityType: 'Product', entityId: id, metadata: data }
    });

    return success(res, { product }, 'Product updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await prisma.adminAuditLog.create({
      data: { adminUserId: req.user.id, action: 'ARCHIVE_PRODUCT', entityType: 'Product', entityId: id }
    });
    return success(res, null, 'Product archived');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
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

    // N1: enforce allowed transitions at the API level — admin UI warns but the API must guard too
    const ALLOWED_TRANSITIONS = {
      PENDING:    ['PROCESSING', 'CANCELLED'],
      PAID:       ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED:    ['DELIVERED', 'CANCELLED'],
      DELIVERED:  [],
      CANCELLED:  [],
      REFUNDED:   []
    };

    const current = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!current) return error(res, 'Order not found', 404);

    const allowed = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowed.includes(status)) {
      return error(res, `Cannot move order from ${current.status} to ${status}`, 400);
    }

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
    
    const spentData = await prisma.order.groupBy({
      by: ['email'],
      where: { paymentStatus: 'PAID' },
      _sum: { total: true }
    });
    const spentMap = Object.fromEntries(
      spentData.map(s => [s.email, s._sum.total || 0])
    );
    const customersWithSpent = customers.map(c => ({
      ...c,
      totalSpent: spentMap[c.email] || 0
    }));

    return success(res, { customers: customersWithSpent }, 'Customers retrieved');
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
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user.id,
        action: 'APPROVE_UPI_PAYMENT',
        entityType: 'Payment',
        entityId: id,
        metadata: {}
      }
    });

    return success(res, null, 'Payment approved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;

    await paymentService.rejectUpiPayment(id);
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user.id,
        action: 'REJECT_UPI_PAYMENT',
        entityType: 'Payment',
        entityId: id,
        metadata: {}
      }
    });

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

// Get single product by ID
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventory: true }
    });
    if (!product) return error(res, 'Product not found', 404);
    return success(res, { product }, 'Product retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Per-product analytics stats (30-day window)
exports.getProductStats = async (req, res) => {
  try {
    const { id } = req.params;
    const since30 = new Date(Date.now() - 30 * 86400000);

    const [product, orderItems, pageViews, cartAdds] = await Promise.all([
      prisma.product.findUnique({ where: { id }, include: { inventory: true } }),
      prisma.orderItem.findMany({
        where: { productId: id, order: { paymentStatus: 'PAID' } },
        include: { order: { select: { createdAt: true, total: true } } }
      }),
      prisma.pageView.count({ where: { productId: id, createdAt: { gte: since30 } } }),
      prisma.cartEvent.count({ where: { productId: id, event: 'add_to_cart', createdAt: { gte: since30 } } })
    ]);

    if (!product) return error(res, 'Product not found', 404);

    const totalRevenue = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalUnitsSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    return success(res, {
      product,
      totalOrders: orderItems.length,
      totalRevenue,
      totalUnitsSold,
      pageViews30Days: pageViews,
      cartAdds30Days: cartAdds,
      conversionRate30Days: pageViews > 0 ? ((cartAdds / pageViews) * 100).toFixed(2) : 0
    }, 'Product stats retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Cancel order — PENDING, PAID, PROCESSING, SHIPPED allowed; within 48 hours
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true, items: true }
    });

    if (!order) return error(res, 'Order not found', 404);

    // N1 amendment: SHIPPED is cancellable (lost in transit, customs rejection, warehouse damage)
    if (['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(order.status)) {
      return error(res, `Cannot cancel order with status ${order.status}`, 400);
    }

    const hoursSinceOrder = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    if (hoursSinceOrder > 48) {
      return error(res, 'Orders can only be cancelled within 48 hours of placement', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus
        }
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

      await tx.adminAuditLog.create({
        data: {
          adminUserId: req.user.id,
          action: 'CANCEL_ORDER',
          entityType: 'Order',
          entityId: id,
          metadata: { previousStatus: order.status }
        }
      });
    });

    // C1: non-blocking gateway refund — provider determined by payment record
    const payment = order.payments?.[0] || null;
    if (payment?.status === 'SUCCESS' && payment.providerPaymentId) {
      if (payment.provider === 'RAZORPAY') {
        razorpayService.refundPayment(payment.providerPaymentId)
          .catch(err => console.error('Admin cancel: Razorpay refund error:', err.message));
      } else if (payment.provider === 'PAYPAL') {
        paypalService.refundPayment(payment.providerPaymentId)
          .catch(err => console.error('Admin cancel: PayPal refund error:', err.message));
      }
    }

    // C3: non-blocking cancellation email
    const finalPaymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus;
    emailService.sendOrderCancellation({
      email: order.email,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentStatus: finalPaymentStatus
    }).catch(err => console.error('Admin cancel: cancellation email error:', err.message));

    return success(res, null, 'Order cancelled and inventory restored');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Extended dashboard — revenue, orders, low stock, recent orders, top products, customers
exports.getDashboardExtended = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today.getTime() - 7 * 86400000);
    const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [
      totalOrders, pendingOrders, processingOrders, shippedOrders, deliveredOrders,
      todayRevenue, weekRevenue, monthRevenue, totalRevenue,
      pendingUPI, lowStockItems, recentOrders, topProducts, totalCustomers, newCustomersThisMonth
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: today } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thisWeekStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thisMonthStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.payment.count({ where: { status: 'VERIFICATION_REQUIRED' } }),
      prisma.inventory.findMany({
        where: { stock: { lte: 5 } },
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { stock: 'asc' },
        take: 10
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: true }
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { paymentStatus: 'PAID' } },
        _sum: { lineTotal: true, quantity: true },
        _count: { productId: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 5
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thisMonthStart } } })
    ]);

    return success(res, {
      orders: { total: totalOrders, pending: pendingOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders },
      revenue: {
        today: todayRevenue._sum.total || 0,
        week: weekRevenue._sum.total || 0,
        month: monthRevenue._sum.total || 0,
        total: totalRevenue._sum.total || 0
      },
      pendingUPIVerifications: pendingUPI,
      lowStockItems,
      recentOrders,
      topProducts,
      customers: { total: totalCustomers, newThisMonth: newCustomersThisMonth }
    }, 'Dashboard data retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Analytics — funnel, revenue by day/method, top products
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const _parsed = parseInt(period);
    const days = Math.min(Math.max(isNaN(_parsed) ? 30 : _parsed, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalPageViews,
      uniqueSessionsGroups,
      productPageViews,
      addToCartEvents,
      checkoutStarted,
      checkoutCompleted,
      topProducts,
      dailyRevenue,
      revenueByMethod,
      topProductsByRevenue
    ] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: since } } }),
      prisma.pageView.groupBy({
        by: ['sessionId'],
        where: { createdAt: { gte: since } },
        _count: { sessionId: true }
      }),
      prisma.pageView.count({ where: { createdAt: { gte: since }, path: { contains: 'product-detail' } } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'add_to_cart' } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'checkout_started' } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'checkout_completed' } }),
      prisma.pageView.groupBy({
        by: ['productId'],
        where: { createdAt: { gte: since }, productId: { not: null } },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 10
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: since }, paymentStatus: 'PAID' },
        select: { createdAt: true, total: true }
      }),
      prisma.payment.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since }, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: { provider: true }
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { createdAt: { gte: since }, paymentStatus: 'PAID' } },
        _sum: { lineTotal: true, quantity: true },
        _count: { productId: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10
      })
    ]);

    const uniqueSessions = uniqueSessionsGroups.length;

    const productIds = topProducts.map(p => p.productId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true }
    });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const revenueByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      revenueByDay[d.toISOString().slice(0, 10)] = 0;
    }
    dailyRevenue.forEach(o => {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (revenueByDay[day] !== undefined) revenueByDay[day] += o.total;
    });

    return success(res, {
      summary: {
        totalPageViews,
        uniqueSessions,
        productPageViews,
        addToCartEvents,
        checkoutStarted,
        checkoutCompleted,
        conversionRate: uniqueSessions > 0 ? ((checkoutCompleted / uniqueSessions) * 100).toFixed(2) : 0,
        cartToCheckout: addToCartEvents > 0 ? ((checkoutStarted / addToCartEvents) * 100).toFixed(2) : 0
      },
      topProductsByViews: topProducts.map(p => ({
        productId: p.productId,
        name: productMap[p.productId]?.name || 'Unknown',
        slug: productMap[p.productId]?.slug || '',
        views: p._count.productId
      })),
      topProductsByRevenue,
      revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      revenueByMethod
    }, 'Analytics retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
