const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter - for development, using Gmail SMTP
// In production, you should use a proper email service like SendGrid, Mailgun, etc.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // Your Gmail app password
  },
});

// Generate a secure random token for email verification
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email, verificationToken) {
  const verificationUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your Melodia account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Melodia!</h2>
        <p>Thank you for signing up for Melodia. Please verify your email address to complete your registration.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        
        <p style="color: #666; font-size: 14px;">
          This link will expire in 24 hours. If you didn't create an account with Melodia, you can safely ignore this email.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This email was sent from Melodia. Please do not reply to this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

// Send password reset email (bonus feature)
async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset your Melodia password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested to reset your password for your Melodia account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #ff6b6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This email was sent from Melodia. Please do not reply to this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
