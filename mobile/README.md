# Febaco Mobile App

Official mobile application for the Federation of Basketball of Congo (FEBACO), built with React Native and Expo.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- For iOS development: macOS with Xcode installed
- For Android development: Android Studio with Android SDK

### Installation

```bash
cd mobile
npm install
```

### Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run on web
npm run web
```

### Using Expo Go

1. Install the "Expo Go" app on your iOS or Android device
2. Run `npm start` in the mobile directory
3. Scan the QR code with your device camera (iOS) or Expo Go app (Android)

## Project Structure

```
mobile/
├── app/                    # Expo Router app directory
│   ├── _layout.tsx        # Root layout with navigation stack
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── _layout.tsx    # Tab bar configuration
│   │   ├── index.tsx      # Home screen
│   │   ├── teams.tsx      # Teams list (Firestore connected)
│   │   ├── schedule.tsx   # Game schedule
│   │   ├── standings.tsx  # League standings (Firestore connected)
│   │   └── account.tsx    # User account (Firebase Auth)
│   ├── team/              # Team details
│   │   └── [id].tsx       # Dynamic team page
│   ├── player/            # Player details
│   │   └── [id].tsx       # Dynamic player page
│   └── game/              # Game details
│       └── [id].tsx       # Dynamic game page
├── assets/                # Images, icons, splash screens
├── constants/             # App constants (colors, spacing)
├── contexts/              # React contexts (Auth)
├── hooks/                 # Custom hooks (Firestore)
├── lib/                   # Firebase configuration
├── types/                 # TypeScript type definitions
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## Firebase Integration

The app is configured to use the same Firebase project as the web app:
- **Authentication**: Email/password sign-in and sign-up
- **Firestore**: Teams, games, standings, and user profiles
- **Storage**: Team logos and player images

Firebase is initialized in [lib/firebase.ts](lib/firebase.ts).

## Building for Production

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

Create an account at https://expo.dev if you don't have one.

### Step 3: Configure the Project

```bash
eas build:configure
```

This will set up your project for building.

### Step 4: Build for iOS

```bash
# Development build (for testing)
eas build --platform ios --profile development

# Production build (for App Store)
eas build --platform ios --profile production
```

**Requirements for iOS:**
- Apple Developer account ($99/year)
- Bundle identifier configured in app.json: `com.febaco.app`
- App Store Connect app created

### Step 5: Build for Android

```bash
# Preview build (APK for testing)
eas build --platform android --profile preview

# Production build (AAB for Play Store)
eas build --platform android --profile production
```

**Requirements for Android:**
- Google Play Developer account ($25 one-time)
- Package name configured in app.json: `com.febaco.app`

## Submitting to App Stores

### Apple App Store

1. Create app in App Store Connect
2. Update [eas.json](eas.json) with your Apple credentials:
   ```json
   "ios": {
     "appleId": "your-apple-id@email.com",
     "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
     "appleTeamId": "YOUR_TEAM_ID"
   }
   ```
3. Submit:
   ```bash
   eas submit --platform ios
   ```

### Google Play Store

1. Create app in Google Play Console
2. Create a service account and download the JSON key
3. Save as `google-services-key.json` in the mobile folder
4. Submit:
   ```bash
   eas submit --platform android
   ```

## Environment Configuration

### For Different Environments

Create `app.config.js` for environment-specific configuration:

```javascript
export default ({ config }) => ({
  ...config,
  extra: {
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    // Add other environment variables
  },
});
```

## Features

- ✅ Tab-based navigation
- ✅ Team listings (Firestore)
- ✅ League standings (Firestore)
- ✅ User authentication (Firebase Auth)
- ✅ Game schedule view
- ✅ Player profiles
- ✅ EAS Build configuration
- ⬜ Push notifications
- ⬜ Live game updates
- ⬜ Offline support

## Design

The app uses the same color scheme as the web version:
- Primary: `#f59e0b` (Amber)
- Background: `#0f0f1a` (Dark navy)
- Surface: `#1a1a2e` (Light navy)

## Troubleshooting

### Build Errors

If you encounter peer dependency issues:
```bash
npm install --legacy-peer-deps
```

### Firebase Errors

Make sure the Firebase configuration in [lib/firebase.ts](lib/firebase.ts) matches your project.

### EAS Build Issues

Check the EAS dashboard at https://expo.dev for detailed build logs.

## License

© 2026 FEBACO - All rights reserved
