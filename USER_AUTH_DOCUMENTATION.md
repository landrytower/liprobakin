# User Authentication & Profile System Documentation

## Overview
This system implements a comprehensive user registration, authentication, and role-based profile setup with verification workflows for Players, Coaches/Staff, and Fans.

## Architecture

### Components Created

#### 1. Authentication System
- **Location**: `src/contexts/AuthContext.tsx`
- **Features**:
  - User registration with email/password
  - Login/logout functionality
  - Firebase Authentication integration
  - User profile management
  - Automatic profile data synchronization

#### 2. User Types & Data Models
- **Location**: `src/types/user.ts`
- **User Roles**:
  - **Player**: Requires team verification
  - **Coach/Staff**: Requires team verification
  - **Fan**: No verification required
- **Verification Statuses**: `pending`, `approved`, `rejected`

#### 3. UI Components

##### AuthModal (`src/components/AuthModal.tsx`)
- Dual-mode modal for login/signup
- Form validation
- Error handling
- Automatic redirect to profile setup after registration

##### Profile Setup Page (`src/app/profile-setup/page.tsx`)
- Three-step wizard:
  1. Role selection
  2. Role-specific setup (Player/Staff or Fan)
  3. Submission and redirect
- Dynamic data loading from Firebase
- Image upload for ID verification

##### Verification Pending Page (`src/app/verification-pending/page.tsx`)
- Status page for users awaiting admin approval
- Clear instructions on next steps
- Auto-redirect for approved users

##### Admin Verification Dashboard (`src/app/admin/verifications/page.tsx`)
- View all pending verification requests
- Review submitted ID documents
- Approve or reject requests with notes
- Update user status in real-time

### Firebase Collections

#### `users` Collection
```typescript
{
  uid: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role?: "player" | "coach" | "staff" | "fan";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // For Players/Staff
  teamId?: string;
  teamName?: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  verificationImageUrl?: string;
  verificationSubmittedAt?: Timestamp;
  verificationReviewedAt?: Timestamp;
  verificationReviewedBy?: string;
  verificationNotes?: string;
  
  // For Fans
  favoriteTeamId?: string;
  favoriteTeamName?: string;
  favoriteAthleteId?: string;
  favoriteAthleteName?: string;
}
```

#### `verificationRequests` Collection
```typescript
{
  id: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
  role: "player" | "coach" | "staff";
  teamId: string;
  teamName: string;
  selectedPersonName: string;
  selectedPersonId?: string;
  idImageUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  notes?: string;
}
```

### Firebase Storage Structure
```
/verification/
  /{userId}/
    /image-filename.jpg
```

## User Flows

### 1. New User Registration (Player/Staff)
1. Click "👤 Log In / Sign Up" in header
2. Fill signup form: First Name, Last Name, Phone, Email, Password
3. Submit → Redirected to Profile Setup
4. Select role: Player or Coach/Staff
5. Select team from dropdown
6. Select name from team roster
7. Upload ID document photo
8. Submit for verification
9. Redirected to "Verification Pending" page
10. Wait for admin approval

### 2. New User Registration (Fan)
1. Click "👤 Log In / Sign Up" in header
2. Fill signup form
3. Submit → Redirected to Profile Setup
4. Select role: Fan
5. Select favorite team
6. Select favorite athlete
7. Submit → Redirected to homepage

### 3. Admin Verification Workflow
1. Login to admin dashboard
2. Click "✅ Verifications" tab
3. View list of pending requests
4. Click on a request to review
5. View user details and uploaded ID
6. Add optional review notes
7. Click "Approve" or "Reject"
8. User profile automatically updated

## Security Considerations

### Firebase Security Rules (Recommended)
```javascript
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
    }
    
    // Only authenticated users can create verification requests
    match /verificationRequests/{requestId} {
      allow create: if request.auth != null;
      allow read, update: if request.auth != null; // Admins only in production
    }
  }
}

// Storage rules
service firebase.storage {
  match /b/{bucket}/o {
    match /verification/{userId}/{allPaths=**} {
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Admins can read any
    }
  }
}
```

## Integration Points

### Header Navigation
- Login button added to main navigation
- Conditional rendering: Shows "Sign Out" when authenticated
- Displays user's first name when logged in
- Located in: `src/app/page.tsx`

### Layout Integration
- `AuthProvider` wraps entire application in `src/app/layout.tsx`
- Provides auth context to all pages
- Handles user session management

## Features

### ✅ Implemented
- User registration with email/password
- Phone number collection
- Role-based profile setup
- Player/Staff verification workflow with ID upload
- Fan profile setup (no verification)
- Admin verification dashboard
- Automatic profile synchronization
- Session management
- Verification status tracking

### 🚀 Future Enhancements
1. **Email Notifications**:
   - Welcome email after registration
   - Verification status updates
   - Admin notification for new verifications

2. **Enhanced Verification**:
   - Two-factor authentication
   - Phone number verification
   - Additional identity checks

3. **User Dashboard**:
   - Profile editing
   - Activity history
   - Settings management

4. **Social Features**:
   - Follow teams/players
   - Activity feed
   - Commenting system

5. **Admin Enhancements**:
   - Bulk verification actions
   - Advanced filtering/search
   - Verification history
   - Analytics dashboard

## Testing Checklist

### User Registration & Login
- [ ] User can register with valid credentials
- [ ] User receives appropriate error messages for invalid input
- [ ] User can login with registered credentials
- [ ] User redirected to profile setup after registration
- [ ] User can logout successfully

### Player/Staff Flow
- [ ] User can select Player or Coach/Staff role
- [ ] Teams load correctly in dropdown
- [ ] Roster loads based on selected team
- [ ] ID image uploads successfully
- [ ] Verification request created in Firebase
- [ ] User redirected to verification pending page

### Fan Flow
- [ ] User can select Fan role
- [ ] Teams load in favorites dropdown
- [ ] Athletes load in favorites dropdown
- [ ] Fan profile saves correctly
- [ ] User redirected to homepage

### Admin Verification
- [ ] Admin can access verification page
- [ ] Pending requests display correctly
- [ ] ID images display properly
- [ ] Approve updates user status
- [ ] Reject updates user status
- [ ] Review notes save correctly

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure all imports are correct and TypeScript types are properly defined
2. **Firebase Connection**: Verify Firebase config in `src/lib/firebase.ts`
3. **Image Upload Fails**: Check Firebase Storage rules and user permissions
4. **Verification Not Appearing**: Verify `verificationRequests` collection exists
5. **User Not Redirected**: Check route guards in profile-setup page

## Support

For issues or questions:
- Check Firebase Console for errors
- Review browser console for client-side errors
- Verify Firestore and Storage rules are properly configured
- Ensure user has proper permissions
