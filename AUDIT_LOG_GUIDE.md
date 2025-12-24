# Audit Log System - Setup & Troubleshooting Guide

## Overview
The audit log system automatically tracks ALL admin actions in the Febakin admin dashboard, including:
- User logins & logouts
- Team/player/coach creation, updates, and deletions
- Game management and stats updates
- News article creation and modifications
- Referee, venue, partner, and committee management
- Admin user management and role changes

## Firebase Setup

### 1. Firestore Rules
The audit logs are stored in the `auditLogs` collection. Ensure your `firestore.rules` includes:

```
match /auditLogs/{logId} {
  allow read: if isAdmin();
  allow create: if isAdmin();
}
```

✅ This is already configured in your project.

### 2. Collection Structure
Collection: `auditLogs`

Each log document contains:
```typescript
{
  action: string,              // e.g., "team_created", "user_login"
  userId: string,              // Firebase Auth UID of the admin
  userEmail: string,           // Email of the admin
  targetType: string,          // "team", "player", "game", etc.
  targetId: string | null,     // ID of the affected resource
  targetName: string | null,   // Name of the affected resource
  details: object,             // Additional context
  sessionId: string,           // Unique session identifier
  deviceInfo: {
    userAgent: string,
    platform: string,
    browser: string,
    isMobile: boolean,
    screenResolution: string,
    language: string,
    timezone: string
  },
  timestamp: Timestamp         // Server timestamp
}
```

## How It Works

### Automatic Logging
Every admin action automatically calls `logAuditAction()`:

```typescript
await logAuditAction(
  "team_created",           // action type
  user.uid,                 // admin user ID
  user.email,               // admin email
  "team",                   // target type
  teamId,                   // target ID
  teamName                  // target name
);
```

### Session Tracking
- When an admin logs in, `logSessionStart()` is called
- When an admin logs out, `logSessionEnd()` is called
- Session data is stored in `userSessions` collection

## Viewing Audit Logs

1. Navigate to the **TRAFIC** tab in the admin dashboard
2. Scroll to the "Traffic & Audit Log" module
3. View the "Admin Activity Monitor" section

**Key Metrics Displayed:**
- **Active Admins**: Number of enabled admin accounts
- **Total Logs**: All-time audit log count
- **Device Types**: Number of mobile sessions

## Testing the Audit Log

### Method 1: Use the Test Button
1. Go to the TRAFIC tab
2. Click the "🧪 Test Log" button
3. Check if a new log appears in the audit trail

### Method 2: Perform an Action
1. Create, update, or delete any resource (team, player, game, etc.)
2. Check the audit trail for the logged action

### Method 3: Login/Logout
1. Sign out and sign back in
2. Check for "logged in" and "logged out" entries

## Troubleshooting

### No Logs Appearing

**Check 1: Firebase Console**
- Go to Firebase Console → Firestore Database
- Look for the `auditLogs` collection
- If it doesn't exist, it will be created on the first log entry

**Check 2: Browser Console**
Open the browser console (F12) and look for:
- ✅ "📝 Creating audit log:" → Log creation started
- ✅ "✅ Audit log created successfully:" → Log saved to Firebase
- ❌ "❌ Failed to log audit action:" → Error occurred

**Check 3: Admin Permissions**
Ensure you're logged in as an admin with an active account:
- Go to the ACCOUNTS tab
- Verify your account status is "Active"

**Check 4: Network Tab**
- Open browser DevTools → Network tab
- Perform an action
- Look for a POST request to Firestore
- Check for errors in the response

### Initialize Collection Manually

If the collection doesn't exist or you want to add a test entry:

```bash
cd scripts
node init-audit-logs.js
```

This script:
1. Checks if `auditLogs` collection exists
2. Creates an initial system log if empty
3. Displays the total log count

### Common Errors

**Error: "Permission denied"**
- Solution: Verify Firestore rules allow admins to create in `auditLogs`
- Check that you're logged in as an admin

**Error: "Collection not found"**
- Solution: Perform any action to create the first log entry
- Or run the init script: `node scripts/init-audit-logs.js`

**Logs created but not visible**
- Solution: Refresh the page
- Check the onSnapshot listener is active
- Verify no JavaScript errors in console

## Console Debugging

Enhanced console logging helps track audit log operations:

```typescript
// When creating a log:
console.log("📝 Creating audit log:", {
  action, userId, userEmail, targetType, targetId, targetName
});

// On success:
console.log("✅ Audit log created successfully:", docRef.id);

// On error:
console.error("❌ Failed to log audit action:", error);
```

## Best Practices

1. **Never disable audit logging** - It's critical for security and accountability
2. **Regularly review logs** - Monitor for suspicious activity
3. **Export logs periodically** - For compliance and backup purposes
4. **Train admins** - Ensure they know all actions are tracked

## Action Types Reference

All supported audit actions:
- `user_login`, `user_logout`
- `team_created`, `team_updated`, `team_deleted`
- `player_added`, `player_updated`, `player_deleted`, `player_transferred`
- `coach_added`, `coach_updated`, `coach_deleted`
- `game_created`, `game_updated`, `game_deleted`, `game_stats_updated`
- `news_created`, `news_updated`, `news_deleted`
- `referee_added`, `referee_updated`, `referee_deleted`
- `venue_added`, `venue_updated`, `venue_deleted`
- `partner_added`, `partner_updated`, `partner_deleted`
- `committee_added`, `committee_updated`, `committee_deleted`
- `admin_user_created`, `admin_roles_updated`, `admin_user_deactivated`, `admin_user_reactivated`, `admin_user_deleted`, `admin_password_changed`
- `stats_reset`, `data_exported`
- `system_test`, `system_initialized`

## Support

If you continue experiencing issues:
1. Check the browser console for detailed error messages
2. Verify Firebase project permissions
3. Ensure you're using the latest version of the admin dashboard
4. Review the implementation in `src/lib/auditLog.ts`

---
Last updated: December 24, 2025
