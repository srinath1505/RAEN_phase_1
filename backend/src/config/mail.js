const nodemailer = require('nodemailer');
const config = require('./env');

let transporter;

if (config.email.provider === 'sendgrid') {
  // SendGrid configuration
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(config.email.sendgridApiKey);
  
  transporter = {
    sendMail: async (options) => {
      const msg = {
        to: options.to,
        from: options.from || config.email.from,
        subject: options.subject,
        html: options.html,
        text: options.text
      };
      return sgMail.send(msg);
    }
  };
} else {
  // Nodemailer SMTP configuration
  transporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: false,
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.pass
    }
  });
}

module.exports = transporter;
