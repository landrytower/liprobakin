/**
 * Password Reset Utility Functions
 * Client-safe utilities for password reset flow
 * 
 * NOTE: For SMS sending, use sms.server.ts (server-only)
 */

/**
 * Normalize phone number to E.164 format required by Twilio
 * E.164 format: +[country code][number] e.g., +12025551234, +447911123456, +33612345678
 * 
 * This handles various input formats from ANY country:
 * - +12025551234 → +12025551234 (US)
 * - +447911123456 → +447911123456 (UK)
 * - +33612345678 → +33612345678 (France)
 * - +237612345678 → +237612345678 (Cameroon)
 * - +1 (202) 555-1234 → +12025551234 (with spaces/formatting)
 * 
 * NOTE: Country code is REQUIRED. The function will clean formatting but
 * the user must include their country code (e.g., +1 for US, +44 for UK, +237 for Cameroon)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Check if starts with + (has country code)
  const hasCountryCode = phone.trim().startsWith('+');
  
  // Remove all non-digit characters
  const digitsOnly = phone.trim().replace(/\D/g, '');
  
  // If it started with +, add it back
  if (hasCountryCode) {
    return '+' + digitsOnly;
  }
  
  // If no + but has digits, add + prefix
  // (User should include country code digits)
  if (digitsOnly.length > 0) {
    return '+' + digitsOnly;
  }
  
  return '';
}

/**
 * Validate phone number format (E.164)
 * Must start with + followed by country code and number (10-15 digits total)
 * Examples of valid numbers:
 * - +12025551234 (US)
 * - +447911123456 (UK)
 * - +33612345678 (France)
 * - +237612345678 (Cameroon)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // E.164 format: + followed by 10-15 digits (includes country code)
  return /^\+\d{10,15}$/.test(normalized);
}

/**
 * Get example phone format hint based on common countries
 */
export function getPhoneFormatHint(): string {
  return "Include country code: +1 (US), +44 (UK), +33 (France), +237 (Cameroon), etc.";
}

/**
 * Generate a 6-digit verification code
 */
export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate reset code format
 */
export function isValidResetCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Check if reset code has expired
 */
export function isResetCodeExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}
