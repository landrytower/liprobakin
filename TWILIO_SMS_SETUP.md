# Twilio SMS Setup Guide for Password Reset

## Overview
Your FEBACO password reset system now supports SMS delivery via Twilio. This guide will help you set up Twilio for sending password reset codes via SMS.

## Current Status
✅ **Twilio integration is configured and ready to use**
- The code checks for Twilio credentials
- If credentials are missing, it falls back to console logging (development mode)
- Once you add credentials, SMS will be sent automatically

## How to Get Twilio Credentials

### Step 1: Create a Twilio Account
1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Sign up for a free Twilio account
3. Verify your email and phone number

### Step 2: Get Your Credentials
1. In the Twilio Console, go to the **Account** section
2. Copy your:
   - **Account SID** (starts with "AC...")
   - **Auth Token** (keep this secret!)

### Step 3: Get a Twilio Phone Number
1. In the Twilio Console, go to **Phone Numbers**
2. Click **+ Get your first Twilio phone number**
3. Choose a phone number and confirm
4. Copy the phone number (e.g., +1234567890)

### Step 4: Update Your .env.local
Edit your `.env.local` file and replace the placeholder values:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

Example with real values:
```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
TWILIO_AUTH_TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz123456
TWILIO_PHONE_NUMBER=+15551234567
```

### Step 5: Restart Your Dev Server
```bash
# Stop the current server (Ctrl+C) or:
npm run dev
```

## How It Works

When a user initiates a phone-based password reset:

1. **User enters phone number** → System looks up the user
2. **Code is generated** → 6-digit verification code
3. **SMS is sent** → Via Twilio to the user's phone
4. **User receives SMS** → With the reset code
5. **User enters code** → To verify ownership
6. **Password is updated** → Directly in Firebase
7. **User signs in** → With the new password

## Testing in Development

### Without Twilio Credentials
- Codes are logged to the **console/terminal**
- Check your terminal to see the code
- Perfect for testing without phone costs

### With Twilio Credentials
- SMS is sent to the actual phone number
- User receives real SMS messages
- Fully functional production-ready system

## Security Considerations

1. **Never commit credentials to git**
   - Use `.env.local` (already in .gitignore)
   - Never share your Auth Token

2. **Rate limiting**
   - Consider adding max attempts per phone number
   - Prevent SMS bombing attacks

3. **Cost management**
   - Twilio charges per SMS
   - Implement daily/monthly limits if needed
   - Monitor your Twilio dashboard

## Troubleshooting

### SMS Not Received
- Verify the phone number format includes country code (e.g., +1 for USA)
- Check your Twilio account balance
- Check Twilio logs in their console
- Ensure Twilio account is verified

### "Invalid Twilio Credentials"
- Verify Account SID is correct (starts with "AC")
- Verify Auth Token is correct (no extra spaces)
- Check .env.local syntax (no quotes around values)
- Restart the dev server after changing .env.local

### Code Still Appearing in Console
- This is normal if credentials aren't set
- Add Twilio credentials to .env.local
- Restart the server
- Try again - SMS should be sent instead

## Production Deployment

When deploying to production (Vercel, etc.):

1. **Add environment variables** in your platform's settings:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

2. **For Vercel**:
   - Go to Project Settings → Environment Variables
   - Add the three Twilio variables
   - Redeploy

3. **For other platforms**:
   - Follow their documentation for adding secrets/env variables
   - Never put credentials in `.env.local` in production

## Cost Estimation

As of 2024, Twilio SMS pricing:
- **Incoming SMS**: Usually free or minimal
- **Outgoing SMS**: ~$0.0075 per SMS (varies by country)

For 1000 password resets per month:
- ~$7.50 USD (USA numbers)
- Rates vary by destination country

## Alternative SMS Providers

If Twilio doesn't work for you, alternatives include:
- **AWS SNS** (Amazon Simple Notification Service)
- **Firebase** (has SMS capabilities)
- **Vonage** (formerly Nexmo)
- **MessageBird**
- **Infratel** (local to some regions)

To switch providers, update the `sendResetCodeSMS()` function in `src/lib/passwordReset.ts`.

## Support

- **Twilio Support**: https://support.twilio.com/
- **Twilio Docs**: https://www.twilio.com/docs/
- **FEBACO Team**: Contact your developer

---

**You're all set!** 🎉 Add your Twilio credentials and SMS password resets will work seamlessly.
