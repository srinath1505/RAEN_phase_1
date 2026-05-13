const prisma = require('../config/db');

class ProductService {
  // Helper to format product (parse JSON fields)
  formatProduct(product) {
    if (!product) return null;
    
    return {
      ...product,
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
      sizes: typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes
    };
  }

  async getAllProducts(filters = {}) {
    const { category, status = 'ACTIVE', search } = filters;
    
    const where = {
      status,
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };
    
    const products = await prisma.product.findMany({
      where,
      include: {
        inventory: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return products.map(p => this.formatProduct(p));
  }
  
  async getProductBySlug(slug) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        inventory: true
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return this.formatProduct(product);
  }
  
  async getProductById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventory: true
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return this.formatProduct(product);
  }
  
  async getInventory(productId) {
    const inventory = await prisma.inventory.findMany({
      where: { productId }
    });
    
    return inventory;
  }
  
  async checkStock(productId, size, quantity) {
    const inventoryItem = await prisma.inventory.findFirst({
      where: {
        productId,
        size
      }
    });
    
    if (!inventoryItem) {
      return { available: false, message: 'Size not available' };
    }
    
    const availableStock = inventoryItem.stock - inventoryItem.reservedStock;
    
    if (availableStock < quantity) {
      return {
        available: false,
        message: `Only ${availableStock} items available in stock`
      };
    }
    
    return { available: true, inventoryItem };
  }
}

module.exports = new ProductService();
