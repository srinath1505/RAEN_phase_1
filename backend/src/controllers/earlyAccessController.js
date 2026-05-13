const prisma = require('../config/db');
const emailService = require('../services/emailService');
const { success, error } = require('../utils/apiResponse');

exports.submit = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      city,
      interest,
      budgetOrPreference,
      acceptedPrivacy,
      wantsUpdates
    } = req.body;
    
    const request = await prisma.earlyAccessRequest.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        city,
        interest,
        budgetOrPreference,
        acceptedPrivacy: acceptedPrivacy || false,
        wantsUpdates: wantsUpdates || false
      }
    });
    
    // Send confirmation email
    await emailService.sendEarlyAccessConfirmation(email, firstName);
    
    return success(res, { request }, 'Early access request submitted', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};
