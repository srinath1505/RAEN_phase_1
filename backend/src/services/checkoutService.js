const prisma = require('../config/db');
const generateOrderNumber = require('../utils/generateOrderNumber');
const calculateTotals = require('../utils/calculateTotals');
const productService = require('./productService');

class CheckoutService {
  async createOrder(data) {
    const { userId, sessionId, email, phone, shippingAddress, billingAddress } = data;
    
    // Get cart
    const cart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    
    // Validate stock for all items
    for (const item of cart.items) {
      const stockCheck = await productService.checkStock(
        item.productId,
        item.size,
        item.quantity
      );
      
      if (!stockCheck.available) {
        throw new Error(`${item.product.name} (${item.size}): ${stockCheck.message}`);
      }
    }
    
    // Calculate subtotal
    let subtotal = 0;
    for (const item of cart.items) {
      // Use price from database, not from cart
      const product = await productService.getProductById(item.productId);
      subtotal += product.price * item.quantity;
    }
    
    // Calculate totals
    const totals = calculateTotals(subtotal);
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        email,
        phone,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        subtotal: totals.subtotal,
        tax: totals.tax,
        shipping: totals.shipping,
        total: totals.total,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress
      }
    });
    
    // Create order items
    for (const item of cart.items) {
      const product = await productService.getProductById(item.productId);
      const images = Array.isArray(product.images) ? product.images : JSON.parse(product.images);
      
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: product.name,
          productSlug: product.slug,
          size: item.size,
          quantity: item.quantity,
          unitPrice: product.price,
          lineTotal: product.price * item.quantity,
          image: images[0] || null
        }
      });
    }
    
    // Return order with items
    const createdOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: true
      }
    });
    
    return createdOrder;
  }
  
  async getCheckoutSummary(userId, sessionId) {
    const cart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    
    let subtotal = 0;
    const items = [];
    
    for (const item of cart.items) {
      const product = await productService.getProductById(item.productId);
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      
      items.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        size: item.size,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal
      });
    }
    
    const totals = calculateTotals(subtotal);
    
    return {
      items,
      ...totals
    };
  }
}

module.exports = new CheckoutService();
