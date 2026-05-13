const prisma = require('../config/db');
const emailService = require('../services/emailService');
const { success, error} = require('../utils/apiResponse');

exports.subscribe = async (req, res) => {
  try {
    const { email, source } = req.body;
    
    // Check if already subscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email }
    });
    
    if (existing) {
      return success(res, null, 'Already subscribed');
    }
    
    await prisma.newsletterSubscriber.create({
      data: {
        email,
        source: source || 'website'
      }
    });
    
    // Send welcome email
    await emailService.sendNewsletterWelcome(email);
    
    return success(res, null, 'Subscription successful', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};
