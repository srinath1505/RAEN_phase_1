const prisma = require('../config/db');

class InventoryService {
  async reduceStock(productId, size, quantity) {
    const inventoryItem = await prisma.inventory.findFirst({
      where: {
        productId,
        size
      }
    });
    
    if (!inventoryItem) {
      throw new Error('Inventory not found');
    }
    
    const availableStock = inventoryItem.stock - inventoryItem.reservedStock;
    
    if (availableStock < quantity) {
      throw new Error('Insufficient stock');
    }
    
    await prisma.inventory.update({
      where: { id: inventoryItem.id },
      data: {
        stock: inventoryItem.stock - quantity
      }
    });
    
    return true;
  }
  
  async reduceStockForOrder(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true
      }
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    for (const item of order.items) {
      await this.reduceStock(item.productId, item.size, item.quantity);
    }
    
    return true;
  }
}

module.exports = new InventoryService();
