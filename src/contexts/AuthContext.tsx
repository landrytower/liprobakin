"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  PhoneAuthProvider,
  linkWithCredential,
  updatePhoneNumber,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import { normalizePhoneNumber } from "@/lib/passwordReset";
import type { UserProfile } from "@/types/user";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phoneNumber: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  // Phone auth methods
  sendPhoneOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  verifyPhoneOTP: (confirmationResult: ConfirmationResult, otp: string, firstName?: string, lastName?: string) => Promise<void>;
  setupRecaptcha: (containerId: string) => RecaptchaVerifier;
  linkPhoneToAccount: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  confirmPhoneLink: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerIdRef = useRef<string | null>(null);

  const fetchUserProfile = async (uid: string) => {
    const userDoc = await getDoc(doc(firebaseDB, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setUserProfile({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        verificationSubmittedAt: data.verificationSubmittedAt?.toDate(),
        verificationReviewedAt: data.verificationReviewedAt?.toDate(),
      } as UserProfile);
    } else {
      setUserProfile(null);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous profile listener
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // Check if user is an admin first
        const adminDoc = await getDoc(doc(firebaseDB, "adminUsers", firebaseUser.uid));
        const isAdminUser = adminDoc.exists();
        setIsAdmin(isAdminUser);

        // Only fetch user profile if NOT an admin
        if (!isAdminUser) {
          await fetchUserProfile(firebaseUser.uid);

          // Set up real-time listener for user profile document
          // Only listen to regular users, not admins
          const collectionName = "users";
          
          unsubscribeProfile = onSnapshot(
            doc(firebaseDB, collectionName, firebaseUser.uid),
            async (docSnapshot) => {
              if (!docSnapshot.exists()) {
                // User profile was deleted from Firestore - kick them out
                console.warn('User profile deleted from Firestore. Signing out...');
                await firebaseSignOut(firebaseAuth);
                setUserProfile(null);
              } else {
                // Update profile with latest data
                const data = docSnapshot.data();
                setUserProfile({
                  ...data,
                  createdAt: data.createdAt?.toDate() || new Date(),
                  updatedAt: data.updatedAt?.toDate() || new Date(),
                  verificationSubmittedAt: data.verificationSubmittedAt?.toDate(),
                  verificationReviewedAt: data.verificationReviewedAt?.toDate(),
                } as UserProfile);
              }
            },
            (error) => {
              console.error("Error listening to user profile:", error);
            }
          );
        } else {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phoneNumber: string
  ) => {
    // Normalize phone number to E.164 format for Firebase Phone Auth
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Check if email already exists in users collection
    const usersRef = collection(firebaseDB, "users");
    const emailQuery = query(usersRef, where("email", "==", email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      throw new Error("This email is already registered. Please use a different email or sign in.");
    }

    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // Update display name
    await updateProfile(userCredential.user, {
      displayName: `${firstName} ${lastName}`,
    });

    // Create user profile document with normalized phone number
    const userProfile: Partial<UserProfile> = {
      uid: userCredential.user.uid,
      email,
      phoneNumber: normalizedPhone, // Store normalized phone number
      firstName,
      lastName,
      phoneVerified: false, // Phone needs OTP verification to use for login
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(firebaseDB, "users", userCredential.user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    let userEmail = emailOrPhone;
    
    // If input looks like a phone number, search for the user by phone number
    if (!emailOrPhone.includes('@')) {
      // Normalize phone number for lookup
      const normalizedPhone = normalizePhoneNumber(emailOrPhone);
      
      // Search for user by phone number
      const usersRef = collection(firebaseDB, "users");
      const phoneQuery = query(usersRef, where("phoneNumber", "==", normalizedPhone));
      const phoneSnapshot = await getDocs(phoneQuery);
      
      if (phoneSnapshot.empty) {
        throw new Error("No account found with this phone number.");
      }
      
      // Get the email associated with this phone number
      const userData = phoneSnapshot.docs[0].data();
      userEmail = userData.email;
    }
    
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, userEmail, password);
    const user = userCredential.user;
    
    // CRITICAL: Check if user exists in adminUsers collection
    const adminDocRef = doc(firebaseDB, "adminUsers", user.uid);
    const adminDocSnap = await getDoc(adminDocRef);
    
    if (adminDocSnap.exists()) {
      // This is an admin user trying to log in via user login - reject
      await firebaseSignOut(firebaseAuth);
      throw new Error("Admin accounts cannot use this login. Please use the Admin Login at the bottom of the page.");
    }
    
    // Check if user exists in users collection
    const userDocRef = doc(firebaseDB, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      // User doesn't exist in users collection - this shouldn't happen
      await firebaseSignOut(firebaseAuth);
      throw new Error("User profile not found. Please contact support.");
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(firebaseAuth, provider);
    const user = userCredential.user;

    // Check if user profile exists, if not create one
    const userDocRef = doc(firebaseDB, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // Create user profile for new Google sign-in
      const nameParts = user.displayName?.split(" ") || ["", ""];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const userProfile: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        firstName,
        lastName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    const userCredential = await signInWithPopup(firebaseAuth, provider);
    const user = userCredential.user;

    // Check if user profile exists, if not create one
    const userDocRef = doc(firebaseDB, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // Create user profile for new Apple sign-in
      const nameParts = user.displayName?.split(" ") || ["", ""];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const userProfile: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        firstName,
        lastName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth);
  };

  // Phone Authentication Methods
  const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error("reCAPTCHA container not found. Please refresh and try again.");
    }

    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore
      }
      recaptchaVerifierRef.current = null;
      recaptchaContainerIdRef.current = null;
    }

    // Clear any existing reCAPTCHA markup
    container.innerHTML = "";

    const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, container, {
      size: "invisible",
      callback: () => {
        console.log("✅ reCAPTCHA solved");
      },
      "expired-callback": () => {
        console.log("⚠️ reCAPTCHA expired");
      },
    });

    recaptchaVerifierRef.current = recaptchaVerifier;
    recaptchaContainerIdRef.current = containerId;
    return recaptchaVerifier;
  };

  const sendPhoneOTP = async (phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> => {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Setup reCAPTCHA
    const recaptchaVerifier = setupRecaptcha(recaptchaContainerId);
    
    try {
      console.log(`📱 Sending OTP to: ${normalizedPhone}`);
      // Ensure widget is rendered before verification
      await recaptchaVerifier.render();
      const confirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, recaptchaVerifier);
      console.log("✅ OTP sent successfully!");
      return confirmationResult;
    } catch (error: unknown) {
      // Clear reCAPTCHA on error
      recaptchaVerifier.clear();
      const err = error as { code?: string; message?: string };
      console.error("❌ Phone Auth Error:", err.code, err.message);
      
      // Provide helpful error messages
      if (err.code === "auth/operation-not-allowed") {
        throw new Error("Phone authentication is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method → Phone");
      } else if (err.code === "auth/invalid-app-credential") {
        const host = typeof window !== "undefined" ? window.location.host : "";
        const protocol = typeof window !== "undefined" ? window.location.protocol : "";
        const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const isSecureOk = typeof window !== "undefined" && (window.isSecureContext || isLocalhost);

        const hints = [
          host ? `Current site: ${protocol}//${host}` : undefined,
          "Verify this domain is listed in Firebase Console → Authentication → Settings → Authorized domains",
          "If you’re testing on a LAN IP (e.g. 192.168.x.x) add it there too",
          !isSecureOk ? "Use https (or localhost) — reCAPTCHA can fail on insecure origins" : undefined,
          "Disable adblock/VPN/privacy extensions that can block reCAPTCHA",
        ].filter(Boolean);

        throw new Error(`reCAPTCHA verification failed (${err.code}).\n${hints.join("\n")}`);
      } else if (err.code === "auth/quota-exceeded") {
        throw new Error("SMS quota exceeded. Please try again later or use a test phone number.");
      }
      throw error;
    }
  };

  const verifyPhoneOTP = async (
    confirmationResult: ConfirmationResult, 
    otp: string,
    firstName?: string,
    lastName?: string
  ): Promise<void> => {
    const userCredential = await confirmationResult.confirm(otp);
    const user = userCredential.user;

    // Check if user profile exists
    const userDocRef = doc(firebaseDB, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // Check if this phone number was already used in another account (email signup)
      const usersRef = collection(firebaseDB, "users");
      const phoneQuery = query(usersRef, where("phoneNumber", "==", user.phoneNumber));
      const phoneSnapshot = await getDocs(phoneQuery);

      if (!phoneSnapshot.empty) {
        // Phone exists in another account - this means they signed up with email
        // We should merge or inform the user
        const existingUserData = phoneSnapshot.docs[0].data();
        
        // Copy the data to the new phone auth account
        const userProfile: Partial<UserProfile> = {
          uid: user.uid,
          email: existingUserData.email || "",
          phoneNumber: user.phoneNumber || "",
          firstName: existingUserData.firstName || firstName || "",
          lastName: existingUserData.lastName || lastName || "",
          phoneVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(userDocRef, {
          ...userProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new user profile for phone sign-in
        const userProfile: Partial<UserProfile> = {
          uid: user.uid,
          email: "",
          phoneNumber: user.phoneNumber || "",
          firstName: firstName || "",
          lastName: lastName || "",
          phoneVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(userDocRef, {
          ...userProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // User exists, update phone verification status
      await setDoc(userDocRef, {
        phoneVerified: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  // Link phone number to existing account (for users who signed up with email)
  const linkPhoneToAccount = async (phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> => {
    if (!firebaseAuth.currentUser) {
      throw new Error("You must be logged in to link a phone number");
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const recaptchaVerifier = setupRecaptcha(recaptchaContainerId);

    try {
      // Use signInWithPhoneNumber to get the verification ID
      // Then we'll use linkWithCredential after verification
      await recaptchaVerifier.render();
      const confirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, recaptchaVerifier);
      return confirmationResult;
    } catch (error: unknown) {
      recaptchaVerifier.clear();
      throw error;
    }
  };

  const confirmPhoneLink = async (confirmationResult: ConfirmationResult, otp: string): Promise<void> => {
    if (!firebaseAuth.currentUser) {
      throw new Error("You must be logged in to link a phone number");
    }

    // Create credential from the OTP
    const credential = PhoneAuthProvider.credential(
      confirmationResult.verificationId,
      otp
    );

    try {
      // Link the phone credential to the current user
      await linkWithCredential(firebaseAuth.currentUser, credential);
      
      // Update phone number in the user's Firestore profile
      const userDocRef = doc(firebaseDB, "users", firebaseAuth.currentUser.uid);
      await setDoc(userDocRef, {
        phoneNumber: firebaseAuth.currentUser.phoneNumber,
        phoneVerified: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "auth/credential-already-in-use") {
        throw new Error("This phone number is already linked to another account");
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
        refreshUserProfile,
        sendPhoneOTP,
        verifyPhoneOTP,
        setupRecaptcha,
        linkPhoneToAccount,
        confirmPhoneLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
