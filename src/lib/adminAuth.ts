import { firebaseAuth, firebaseDB } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  type User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp 
} from "firebase/firestore";
import type { AdminUser, AdminRole } from "@/types/admin";
import { mergePermissions } from "@/types/admin";
import { logAuditAction } from "./auditLog";

/**
 * Create a new admin user account (via API route with Firebase Admin SDK)
 * Only callable by master admins
 */
export async function createAdminAccount(
  email: string,
  displayName: string,
  password: string,
  roles: AdminRole[],
  createdByUid: string
): Promise<{ success: boolean; error?: string; userId?: string; message?: string }> {
  try {
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, displayName, password, roles, createdByUid }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Server error: ${response.status}. ${errorText.substring(0, 100)}`
      };
    }

    const data = await response.json();
    return data;
  } catch (error: unknown) {
    console.error("Error creating admin account:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create admin account" 
    };
  }
}

/**
 * Get admin user data from Firestore
 */
export async function getAdminUser(uid: string): Promise<AdminUser | null> {
  try {
    const adminDoc = await getDoc(doc(firebaseDB, "adminUsers", uid));
    
    if (!adminDoc.exists()) {
      console.log(`No admin document found for UID: ${uid}`);
      return null;
    }
    
    const data = adminDoc.data();
    console.log(`Admin user loaded for ${data.email}:`, { 
      roles: data.roles, 
      isActive: data.isActive,
      isFirstLogin: data.isFirstLogin 
    });
    
    return {
      id: adminDoc.id,
      email: data.email,
      displayName: data.displayName,
      roles: data.roles || [],
      permissions: data.permissions || mergePermissions(data.roles || []),
      isFirstLogin: data.isFirstLogin ?? true,
      createdAt: data.createdAt?.toDate() ?? null,
      createdBy: data.createdBy,
      lastActivity: data.lastActivity?.toDate() ?? null,
      lastLogin: data.lastLogin?.toDate() ?? null,
      isActive: data.isActive ?? true,
    };
  } catch (error) {
    console.error("Error fetching admin user:", error);
    return null;
  }
}

/**
 * Get all admin users
 */
export async function getAllAdminUsers(): Promise<AdminUser[]> {
  try {
    const adminsSnapshot = await getDocs(collection(firebaseDB, "adminUsers"));
    return adminsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        roles: data.roles || [],
        permissions: data.permissions || mergePermissions(data.roles || []),
        isFirstLogin: data.isFirstLogin ?? true,
        createdAt: data.createdAt?.toDate() ?? null,
        createdBy: data.createdBy,
        lastLogin: data.lastLogin?.toDate() ?? null,
        lastActivity: data.lastActivity?.toDate() ?? null,
        isActive: data.isActive ?? true,
      };
    });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return [];
  }
}

/**
 * Update admin user's display name after first login
 */
export async function updateAdminProfile(
  uid: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = firebaseAuth.currentUser;
    if (user) {
      await updateProfile(user, { displayName });
    }
    
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      displayName,
      isFirstLogin: false,
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating admin profile:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update profile" 
    };
  }
}

/**
 * Update admin user roles
 */
export async function updateAdminRoles(
  uid: string,
  roles: AdminRole[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const permissions = mergePermissions(roles);
    
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      roles,
      permissions,
    });
    
    // Log audit trail
    const currentUser = firebaseAuth.currentUser;
    const adminDoc = await getDoc(doc(firebaseDB, "adminUsers", uid));
    const targetEmail = adminDoc.exists() ? adminDoc.data()?.email : "unknown";
    
    if (currentUser) {
      await logAuditAction(
        "admin_roles_updated",
        currentUser.uid,
        currentUser.email || "unknown",
        "admin",
        uid,
        targetEmail
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error updating admin roles:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update roles" 
    };
  }
}

/**
 * Deactivate an admin user
 */
export async function deactivateAdminUser(
  uid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      isActive: false,
    });
    
    // Log audit trail
    const currentUser = firebaseAuth.currentUser;
    const adminDoc = await getDoc(doc(firebaseDB, "adminUsers", uid));
    const targetEmail = adminDoc.exists() ? adminDoc.data()?.email : "unknown";
    
    if (currentUser) {
      await logAuditAction(
        "admin_user_deactivated",
        currentUser.uid,
        currentUser.email || "unknown",
        "admin",
        uid,
        targetEmail
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error deactivating admin user:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to deactivate user" 
    };
  }
}

/**
 * Reactivate an admin user
 */
export async function reactivateAdminUser(
  uid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      isActive: true,
    });
    
    // Log audit trail
    const currentUser = firebaseAuth.currentUser;
    const adminDoc = await getDoc(doc(firebaseDB, "adminUsers", uid));
    const targetEmail = adminDoc.exists() ? adminDoc.data()?.email : "unknown";
    
    if (currentUser) {
      await logAuditAction(
        "admin_user_reactivated",
        currentUser.uid,
        currentUser.email || "unknown",
        "admin",
        uid,
        targetEmail
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error reactivating admin user:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to reactivate user" 
    };
  }
}

/**
 * Record last login time
 */
export async function recordLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      lastLogin: serverTimestamp(),
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error recording last login:", error);
  }
}

/**
 * Update last activity timestamp (called periodically while user is active)
 */
export async function updateLastActivity(uid: string): Promise<void> {
  try {
    await updateDoc(doc(firebaseDB, "adminUsers", uid), {
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating last activity:", error);
  }
}

/**
 * Check if user is a master admin
 */
export async function isMasterAdmin(uid: string): Promise<boolean> {
  const adminUser = await getAdminUser(uid);
  return adminUser?.roles.includes("master") ?? false;
}

/**
 * Delete an admin user (Firestore only - Auth deletion requires server)
 * Only callable by master admins
 */
export async function deleteAdminUser(
  targetUid: string,
  deletedByUid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the deleter is a master admin
    const deleter = await getAdminUser(deletedByUid);
    if (!deleter?.roles.includes('master')) {
      return {
        success: false,
        error: 'Unauthorized: Only master admins can delete users'
      };
    }

    // Prevent self-deletion
    if (targetUid === deletedByUid) {
      return {
        success: false,
        error: 'Cannot delete your own account'
      };
    }

    // Check if target is a master admin
    const target = await getAdminUser(targetUid);
    if (target?.roles.includes('master')) {
      return {
        success: false,
        error: 'Cannot delete another master admin'
      };
    }

    // Delete from Firestore (auth account will remain but won't have admin access)
    await deleteDoc(doc(firebaseDB, 'adminUsers', targetUid));

    // Log audit trail
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      await logAuditAction(
        "admin_user_deleted",
        deletedByUid,
        currentUser.email || "unknown",
        "admin",
        targetUid,
        target?.email || "unknown"
      );
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting admin user:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete admin user" 
    };
  }
}
