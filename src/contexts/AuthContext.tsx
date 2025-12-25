"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
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
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
        } else {
          setUserProfile(null);
        }

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

    // Create user profile document
    const userProfile: Partial<UserProfile> = {
      uid: userCredential.user.uid,
      email,
      phoneNumber,
      firstName,
      lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(firebaseDB, "users", userCredential.user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const signIn = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
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

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth);
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
        signOut,
        refreshUserProfile,
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
