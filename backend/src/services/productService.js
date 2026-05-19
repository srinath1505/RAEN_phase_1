const prisma = require('../config/db');

class ProductService {
  formatProduct(product) {
    if (!product) return null;
    return {
      ...product,
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
      sizes: typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes,
      specifications: product.specifications && typeof product.specifications === 'string'
        ? JSON.parse(product.specifications)
        : (product.specifications || null)
    };
  }

  async getAllProducts(filters = {}) {
    const {
      category, status = 'ACTIVE', search,
      minPrice, maxPrice, inStockOnly, onSaleOnly,
      sortBy = 'featured', page = 1, limit = 12
    } = filters;

    const where = { status };
    const conditions = [];

    if (category) conditions.push({ category });

    if (search) conditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    });

    const priceFilter = {};
    if (minPrice !== undefined && minPrice !== '' && !isNaN(parseFloat(minPrice))) {
      priceFilter.gte = parseFloat(minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== '' && !isNaN(parseFloat(maxPrice))) {
      priceFilter.lte = parseFloat(maxPrice);
    }
    if (Object.keys(priceFilter).length > 0) conditions.push({ price: priceFilter });

    if (inStockOnly === 'true') {
      conditions.push({ inventory: { some: { stock: { gt: 0 } } } });
    }

    if (onSaleOnly === 'true') {
      conditions.push({
        OR: [
          { salePrice: { not: null } },
          { discountPercent: { not: null } }
        ]
      });
    }

    if (conditions.length > 0) where.AND = conditions;

    const orderByMap = {
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      newest: { createdAt: 'desc' },
      featured: { createdAt: 'asc' }
    };
    const orderBy = orderByMap[sortBy] || orderByMap.featured;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { inventory: true },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.product.count({ where })
    ]);

    return {
      products: products.map(p => this.formatProduct(p)),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  async getCategories() {
    const rows = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { category: true }
    });
    return [...new Set(rows.map(r => r.category).filter(Boolean))].sort();
  }

  async getProductBySlug(slug) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { inventory: true }
    });
    if (!product) throw new Error('Product not found');
    return this.formatProduct(product);
  }

  async getProductById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventory: true }
    });
    if (!product) throw new Error('Product not found');
    return this.formatProduct(product);
  }

  async getInventory(productId) {
    return prisma.inventory.findMany({ where: { productId } });
  }

  async checkStock(productId, size, quantity) {
    const inventoryItem = await prisma.inventory.findFirst({
      where: { productId, size }
    });
    if (!inventoryItem) return { available: false, message: 'Size not available' };
    const available = inventoryItem.stock - inventoryItem.reservedStock;
    if (available < quantity) return { available: false, message: `Only ${available} items available in stock` };
    return { available: true, inventoryItem };
  }
}

module.exports = new ProductService();
