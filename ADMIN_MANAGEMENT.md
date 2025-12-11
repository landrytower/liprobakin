# Admin User Management System

## Overview

The admin management system provides role-based access control for the Liprobakin league website. Master admins can create new admin accounts, assign roles, and manage permissions for different administrative tasks.

## Features

### 1. **Role-Based Access Control**

Seven distinct admin roles are available:

- **👑 Master** - Complete control including admin management
- **📰 News Editor** - Manage news articles and stories
- **📅 Game Scheduler** - Create and manage games
- **👥 Team Manager** - Manage teams and players
- **🔵 Referee Manager** - Manage referees
- **🏟️ Venue Manager** - Manage venues
- **🤝 Partner Manager** - Manage partners and committee members

### 2. **Admin Account Creation**

Master admins can create new admin accounts by:

1. Entering the user's email address
2. Selecting one or more roles
3. The system automatically:
   - Creates the Firebase Auth account
   - Generates a temporary password
   - Sends a password reset email to the user
   - Creates an admin user document in Firestore

### 3. **First Login Experience**

When a new admin logs in for the first time:

1. They authenticate with the password reset link from their email
2. A welcome modal appears asking them to set their display name
3. After setting their name, they gain full access to assigned modules

### 4. **Permission System**

Each role has specific permissions that control access to admin modules:

```typescript
- canManageNews: Access to Story Editor
- canManageGames: Access to Game Planner
- canManageTeams: Access to Team Assistant
- canManagePlayers: Access to Player/Roster management
- canManageReferees: Access to Referee management
- canManageVenues: Access to Venue management
- canManagePartners: Access to Partner/Committee management
- canManageAdmins: Access to Admin User Management (Master only)
```

### 5. **Admin Management Interface**

Master admins have access to the "Admins" tab where they can:

- View all admin users
- See user roles and last login times
- Edit user roles
- Activate/deactivate accounts
- Monitor account status

## Technical Implementation

### Files Created

1. **`src/types/admin.ts`** - TypeScript types and role definitions
2. **`src/lib/adminAuth.ts`** - Admin authentication and user management functions

### Database Structure

#### Collection: `adminUsers`

```typescript
{
  id: string;              // Firebase Auth UID
  email: string;           // User email
  displayName?: string;    // User's display name
  roles: AdminRole[];      // Array of assigned roles
  permissions: AdminPermissions; // Merged permissions from roles
  isFirstLogin: boolean;   // Flag for first-time setup
  createdAt: Date;        // Account creation timestamp
  createdBy: string;      // UID of creating admin
  lastLogin: Date | null; // Last login timestamp
  isActive: boolean;      // Account status
}
```

### Key Functions

#### `createAdminAccount(email, roles, createdByUid)`
Creates a new admin account with specified roles and sends password reset email.

#### `getAdminUser(uid)`
Retrieves admin user data from Firestore.

#### `getAllAdminUsers()`
Returns all admin users (accessible only to master admins).

#### `updateAdminRoles(uid, roles)`
Updates the roles for an existing admin user.

#### `updateAdminProfile(uid, displayName)`
Updates user's display name and marks first login as complete.

#### `deactivateAdminUser(uid)` / `reactivateAdminUser(uid)`
Toggle user account active status.

#### `recordLastLogin(uid)`
Updates the last login timestamp for tracking.

## Usage Guide

### For Master Admins

1. **Creating a New Admin:**
   - Navigate to the "Admins" tab
   - Click "+ Create New Admin"
   - Enter the email address
   - Select appropriate roles
   - Click "Create Admin Account"
   - The user will receive an email to set their password

2. **Managing Existing Admins:**
   - Click "Edit Roles" to modify user permissions
   - Click "Deactivate" to suspend access (cannot deactivate yourself)
   - View last login time and current status

### For New Admins

1. **First Login:**
   - Check email for password reset link
   - Set a secure password
   - Enter your display name when prompted
   - Access your assigned admin modules

2. **Changing Password:**
   - Use the password reset email received during account creation
   - Or request a new password reset through Firebase

## Security Considerations

- Only master admins can create or manage other admin accounts
- Password reset emails are used instead of storing passwords
- Users cannot deactivate themselves
- All admin actions are tied to authenticated Firebase users
- Permissions are checked on both client and server side

## Module Access Control

The admin dashboard now checks permissions before displaying modules:

```typescript
{currentAdminUser?.permissions.canManageNews && (
  // Story Editor module
)}

{currentAdminUser?.permissions.canManageGames && (
  // Game Planner module
)}
```

## Future Enhancements

Potential improvements:
- Audit log for admin actions
- Email notifications for role changes
- Two-factor authentication
- Session timeout management
- Bulk user management
- Custom permission combinations beyond predefined roles

## Troubleshooting

**Q: New admin cannot log in**
A: Ensure they used the password reset link from the email

**Q: Admin sees "Access Denied"**
A: Check their assigned roles match the required permissions

**Q: Cannot create admin account**
A: Verify you have master role and check Firebase Auth quota

**Q: First login modal won't close**
A: Ensure display name is provided and saved successfully

## Support

For issues or questions about the admin management system, contact the master administrator or check the Firebase console logs for detailed error messages.
