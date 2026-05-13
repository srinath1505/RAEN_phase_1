const prisma = require('../config/db');

class OrderService {
  async getOrderByNumber(orderNumber) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payments: true
      }
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    return order;
  }
  
  async getOrderById(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true
      }
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    return order;
  }
  
  async getUserOrders(userId) {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return orders;
  }
  
  async updateOrderStatus(orderId, status) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
    
    return order;
  }
  
  async updatePaymentStatus(orderId, paymentStatus) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus }
    });
    
    return order;
  }
}

module.exports = new OrderService();
