# User Authentication System - Quick Setup Guide

## Summary
A complete user registration and authentication system has been implemented with role-based profiles (Player, Coach/Staff, Fan) and an admin verification workflow.

## What Was Created

### 🎯 Core Files
1. **Authentication Context** - `src/contexts/AuthContext.tsx`
2. **User Types** - `src/types/user.ts`
3. **Login/Signup Modal** - `src/components/AuthModal.tsx`
4. **Profile Setup Page** - `src/app/profile-setup/page.tsx`
5. **Verification Pending Page** - `src/app/verification-pending/page.tsx`
6. **Admin Verification Dashboard** - `src/app/admin/verifications/page.tsx`

### ✨ Features
- 👤 Login/Signup button with emoji in header navigation
- 📧 Email & password authentication
- 📱 Phone number collection
- 🎭 Three user roles: Player, Coach/Staff, Fan
- ✅ ID verification for Players and Staff
- ⭐ Favorite team/athlete selection for Fans
- 🔐 Admin verification dashboard
- 🔄 Real-time profile synchronization

## Firebase Setup Required

### 1. Firestore Collections
Create these collections in Firebase Console:
- `users` - User profiles
- `verificationRequests` - Pending verifications

### 2. Storage Setup
Ensure Firebase Storage is enabled for ID uploads at:
```
/verification/{userId}/
```

### 3. Security Rules (Important!)

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /verificationRequests/{requestId} {
      allow create: if request.auth != null;
      allow read, update: if request.auth != null;
    }
  }
}
```

#### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /verification/{userId}/{allPaths=**} {
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }
  }
}
```

## Testing the System

### Test User Registration (Fan)
1. Open the homepage
2. Click "👤 Log In / Sign Up" in the header
3. Click "Sign up"
4. Fill in:
   - First Name: Test
   - Last Name: User
   - Phone: +1234567890
   - Email: test@example.com
   - Password: Test123!
5. Click "Sign Up"
6. Select "Fan" role
7. Choose favorite team and athlete
8. Click "Complete Setup"
9. Should redirect to homepage

### Test User Registration (Player)
1. Follow steps 1-5 above
2. Select "Player" role
3. Select your team
4. Select your name from roster
5. Upload a test ID image
6. Click "Submit for Verification"
7. Should see "Verification Pending" page

### Test Admin Verification
1. Login as admin at `/admin`
2. Click "✅ Verifications" tab
3. Click on a pending request
4. Review the ID image
5. Add optional notes
6. Click "Approve" or "Reject"
7. User's status should update

## User Flows

### Fan Registration Flow
```
Homepage → Click Login/Signup → Sign Up Form → Profile Setup → 
Select Fan Role → Choose Favorites → Complete → Homepage
```

### Player/Staff Registration Flow
```
Homepage → Click Login/Signup → Sign Up Form → Profile Setup → 
Select Player/Staff → Choose Team → Select Name → Upload ID → 
Submit → Verification Pending Page
```

### Admin Approval Flow
```
Admin Login → Verifications Tab → Select Request → Review → 
Approve/Reject → User Profile Updated
```

## UI Elements

### Header Navigation
- **Not logged in**: Shows "👤 Log In / Sign Up" button
- **Logged in**: Shows user's first name and "Sign Out" button
- Button styled to match existing design

### Profile Setup
- Clean three-step wizard
- Role cards with descriptions
- Dynamic form based on role selection
- File upload for ID verification
- Progress indication

### Admin Dashboard
- New "✅ Verifications" tab
- Two-column layout: Request list + Details
- Image preview for ID documents
- Approve/Reject actions with notes

## Next Steps

### Immediate (Required)
1. ✅ Deploy Firebase Security Rules
2. ✅ Test registration flow
3. ✅ Test admin verification
4. ✅ Verify email validation works

### Short-term (Recommended)
1. 📧 Add email notifications for verification status
2. 🔔 Add admin notifications for new verifications
3. 📊 Add verification analytics to admin dashboard
4. 🎨 Customize verification pending page messaging

### Long-term (Optional)
1. 🔐 Add two-factor authentication
2. 📱 Add SMS verification
3. 👥 Add user profile management page
4. 📈 Add user activity tracking
5. 💬 Add social features (comments, likes)

## Troubleshooting

### Login Not Working
- Check Firebase Authentication is enabled
- Verify email/password provider is enabled
- Check browser console for errors

### Verification Upload Fails
- Verify Storage rules are set
- Check file size limits (default 5MB)
- Ensure user is authenticated

### Admin Can't See Verifications
- Verify admin is logged in
- Check Firestore security rules
- Ensure verificationRequests collection exists

### User Not Redirected After Signup
- Check AuthContext is wrapped around app
- Verify router is working
- Check browser console for errors

## Documentation
Full documentation available in: `USER_AUTH_DOCUMENTATION.md`

## Support
- Firebase Console: https://console.firebase.google.com
- Documentation: `USER_AUTH_DOCUMENTATION.md`
- Types: `src/types/user.ts`
