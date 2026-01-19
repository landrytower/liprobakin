/**
 * Server-only SMS/Email utilities using Twilio
 * This file should ONLY be imported in API routes (server-side)
 */

import twilio from 'twilio';

/**
 * Send reset code via email
 * In production, integrate with SendGrid, AWS SES, or similar
 */
export async function sendResetCodeEmail(email: string, code: string, firstName: string): Promise<boolean> {
  try {
    // TODO: Replace with actual email service (SendGrid, AWS SES, etc.)
    console.log(`Sending reset code ${code} to email: ${email}`);
    
    // Temporary: Log to console (for development)
    console.log(`
      ====================================
      PASSWORD RESET CODE
      Email: ${email}
      Name: ${firstName}
      Code: ${code}
      Expires: 10 minutes
      ====================================
    `);
    
    return true;
  } catch (error) {
    console.error('Error sending reset code email:', error);
    return false;
  }
}

/**
 * Send reset code via SMS using Twilio
 * Requires Twilio credentials in environment variables
 */
export async function sendResetCodeSMS(phoneNumber: string, code: string, firstName: string): Promise<boolean> {
  try {
    // Check if Twilio credentials are available
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials not configured. Logging code to console instead.");
      console.log(`
        ====================================
        PASSWORD RESET CODE (SMS)
        Phone: ${phoneNumber}
        Name: ${firstName}
        Code: ${code}
        Message: Your FEBACO password reset code is: ${code}. Valid for 10 minutes.
        ====================================
      `);
      return true;
    }

    // Use Twilio to send SMS
    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: `Hi ${firstName}, your FEBACO password reset code is: ${code}. Valid for 10 minutes.`,
      from: fromNumber,
      to: phoneNumber,
    });

    console.log(`SMS sent successfully. Message SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    return false;
  }
}

/**
 * Send reset link via SMS using Twilio
 * Requires Twilio credentials in environment variables
 */
export async function sendResetLinkSMS(phoneNumber: string, resetLink: string, firstName: string): Promise<boolean> {
  try {
    // Check if Twilio credentials are available
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials not configured. Logging link to console instead.");
      console.log(`
        ====================================
        PASSWORD RESET LINK (SMS)
        Phone: ${phoneNumber}
        Name: ${firstName}
        Link: ${resetLink}
        Message: Hi ${firstName}, reset your FEBACO password by clicking this link: ${resetLink}. Link expires in 1 hour.
        ====================================
      `);
      return true;
    }

    // Use Twilio to send SMS
    const client = twilio(accountSid, authToken);

    console.log(`🔍 Sending SMS - From: ${fromNumber}, To: ${phoneNumber}`);
    console.log(`📱 Message: Hi ${firstName}, reset your FEBACO password by clicking this link: ${resetLink}. Link expires in 1 hour.`);

    const message = await client.messages.create({
      body: `Hi ${firstName}, reset your FEBACO password by clicking this link: ${resetLink}. Link expires in 1 hour.`,
      from: fromNumber,
      to: phoneNumber,
    });

    console.log(`✅ SMS sent successfully. Message SID: ${message.sid}`);
    console.log(`📊 Message Status: ${message.status}`);
    console.log(`🔍 Message Error Code: ${message.errorCode || 'None'}`);
    console.log(`📍 Message Direction: ${message.direction}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    return false;
  }
}

/**
 * Send reset link via email
 * In production, integrate with SendGrid, AWS SES, or similar
 */
export async function sendResetLinkEmail(email: string, resetLink: string, firstName: string): Promise<boolean> {
  try {
    // TODO: Replace with actual email service (SendGrid, AWS SES, etc.)
    console.log(`Sending reset link ${resetLink} to email: ${email}`);
    
    // Temporary: Log to console (for development)
    console.log(`
      ====================================
      PASSWORD RESET LINK
      Email: ${email}
      Name: ${firstName}
      Link: ${resetLink}
      Expires: 1 hour
      ====================================
    `);
    
    return true;
  } catch (error) {
    console.error('Error sending reset link email:', error);
    return false;
  }
}

/**
 * Send generic SMS via Twilio
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials not configured.");
      console.log(`Would send SMS to ${phoneNumber}: ${message}`);
      return true;
    }

    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phoneNumber,
    });

    console.log(`SMS sent successfully. Message SID: ${result.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}
