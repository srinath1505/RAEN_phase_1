const prisma = require('../config/db');
const emailService = require('../services/emailService');
const { success, error } = require('../utils/apiResponse');

exports.submit = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message
      }
    });
    
    // Send acknowledgment email
    await emailService.sendContactAcknowledgment(email, name);
    
    return success(res, { message: contactMessage }, 'Message sent successfully', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};
