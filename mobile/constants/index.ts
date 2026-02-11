// Febaco Mobile App Constants
// These match the web app's color scheme and branding

export const COLORS = {
  // Primary colors
  primary: "#f59e0b", // Amber/Gold
  primaryDark: "#d97706",
  
  // Background colors
  background: "#0f0f1a",
  surface: "#1a1a2e",
  surfaceLight: "#2d2d44",
  
  // Text colors
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  
  // Status colors
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  
  // Border colors
  border: "#2d2d44",
};

export const FONTS = {
  regular: "System",
  medium: "System",
  bold: "System",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// API Configuration
export const API_CONFIG = {
  // Firebase project configuration - update these with your actual values
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
  },
};

// App metadata
export const APP_INFO = {
  name: "Febaco",
  version: "1.0.0",
  description: "Federation of Basketball of Congo - Official Mobile App",
};
