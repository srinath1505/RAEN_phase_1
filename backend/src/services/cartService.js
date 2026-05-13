const prisma = require('../config/db');
const productService = require('./productService');

class CartService {
  // Helper to format cart items (parse product JSON fields)
  formatCartItem(item) {
    if (!item) return null;
    
    return {
      ...item,
      product: item.product ? productService.formatProduct(item.product) : null
    };
  }

  formatCart(cart) {
    if (!cart) return null;
    
    return {
      ...cart,
      items: cart.items ? cart.items.map(item => this.formatCartItem(item)) : []
    };
  }

  async getCart(userId, sessionId) {
    let cart = await prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId,
          sessionId
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
    }
    
    return this.formatCart(cart);
  }
  
  async addItem(userId, sessionId, productId, size, quantity) {
    const product = await productService.getProductById(productId);
    
    // Check stock
    const stockCheck = await productService.checkStock(productId, size, quantity);
    if (!stockCheck.available) {
      throw new Error(stockCheck.message);
    }
    
    const cart = await this.getCart(userId, sessionId);
    
    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        size
      }
    });
    
    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      
      // Re-check stock for new quantity
      const stockRecheck = await productService.checkStock(productId, size, newQuantity);
      if (!stockRecheck.available) {
        throw new Error(stockRecheck.message);
      }
      
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: { product: true }
      });
      
      return this.formatCartItem(updatedItem);
    }
    
    // Create new cart item
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        size,
        quantity,
        unitPrice: product.price
      },
      include: {
        product: true
      }
    });
    
    return this.formatCartItem(cartItem);
  }
  
  async updateItem(itemId, quantity, userId, sessionId) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, product: true }
    });
    
    if (!item) {
      throw new Error('Cart item not found');
    }
    
    // Verify ownership
    const isOwner = item.cart.userId === userId || item.cart.sessionId === sessionId;
    if (!isOwner) {
      throw new Error('Unauthorized');
    }
    
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    // Check stock
    const stockCheck = await productService.checkStock(item.productId, item.size, quantity);
    if (!stockCheck.available) {
      throw new Error(stockCheck.message);
    }
    
    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: { product: true }
    });
    
    return this.formatCartItem(updatedItem);
  }
  
  async removeItem(itemId, userId, sessionId) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true }
    });
    
    if (!item) {
      throw new Error('Cart item not found');
    }
    
    // Verify ownership
    const isOwner = item.cart.userId === userId || item.cart.sessionId === sessionId;
    if (!isOwner) {
      throw new Error('Unauthorized');
    }
    
    await prisma.cartItem.delete({
      where: { id: itemId }
    });
    
    return true;
  }
  
  async clearCart(userId, sessionId) {
    const cart = await this.getCart(userId, sessionId);
    
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });
    
    return true;
  }
  
  async syncGuestCart(userId, guestSessionId) {
    const guestCart = await prisma.cart.findFirst({
      where: { sessionId: guestSessionId },
      include: { items: true }
    });
    
    if (!guestCart || guestCart.items.length === 0) {
      return;
    }
    
    const userCart = await this.getCart(userId, null);
    
    for (const item of guestCart.items) {
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: item.productId,
          size: item.size
        }
      });
      
      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + item.quantity }
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }
        });
      }
    }
    
    // Delete guest cart
    await prisma.cart.delete({
      where: { id: guestCart.id }
    });
    
    return true;
  }
}

module.exports = new CartService();
