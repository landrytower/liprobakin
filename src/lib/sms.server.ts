/**
 * Server-only SMS/Email utilities
 * SMS OTP is now handled by Firebase Phone Authentication
 * This file is for password reset via email only
 */

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
 * Send reset code via SMS
 * NOTE: For phone authentication and OTP, use Firebase Phone Auth instead
 * This is a fallback that logs to console for development
 */
export async function sendResetCodeSMS(phoneNumber: string, code: string, firstName: string): Promise<boolean> {
  try {
    // Firebase Phone Auth handles SMS OTP automatically
    // This is just a fallback for password reset codes
    console.log(`
      ====================================
      PASSWORD RESET CODE (SMS)
      Phone: ${phoneNumber}
      Name: ${firstName}
      Code: ${code}
      Message: Your FEBACO password reset code is: ${code}. Valid for 10 minutes.
      
      NOTE: For OTP login, use Firebase Phone Authentication
      ====================================
    `);
    return true;
  } catch (error) {
    console.error('Error logging SMS code:', error);
    return false;
  }
}

/**
 * Send reset link via SMS
 * NOTE: For phone authentication, use Firebase Phone Auth instead
 */
export async function sendResetLinkSMS(phoneNumber: string, resetLink: string, firstName: string): Promise<boolean> {
  try {
    // Firebase Phone Auth handles SMS OTP automatically
    // This is just a fallback for password reset links
    console.log(`
      ====================================
      PASSWORD RESET LINK (SMS)
      Phone: ${phoneNumber}
      Name: ${firstName}
      Link: ${resetLink}
      
      NOTE: For OTP login, use Firebase Phone Authentication
      ====================================
    `);
    return true;
  } catch (error) {
    console.error('Error logging SMS link:', error);
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
 * Send generic SMS
 * NOTE: For phone authentication and OTP, use Firebase Phone Auth instead
 * This is a console log only for development purposes
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    // Firebase Phone Auth handles SMS OTP automatically
    // This is just for development logging
    console.log(`
      ====================================
      SMS MESSAGE
      Phone: ${phoneNumber}
      Message: ${message}
      
      NOTE: For OTP login, use Firebase Phone Authentication
      ====================================
    `);
    return true;
  } catch (error) {
    console.error('Error logging SMS:', error);
    return false;
  }
}
