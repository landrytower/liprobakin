"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { getAdminUser } from "@/lib/adminAuth";
import { logAuditAction } from "@/lib/auditLog";
import { normalizePhoneNumber, isValidPhoneNumber } from "@/lib/passwordReset";
import type { AdminPermissions } from "@/types/admin";

type Referee = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  headshotUrl?: string;
  createdAt: Date | null;
};

type RefereeFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  headshotFile?: File;
};

type Venue = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  capacity?: number;
  createdAt: Date | null;
};

type VenueFormState = {
  id?: string;
  name: string;
  address: string;
  city: string;
  capacity: string;
};

type StatusMessage = {
  type: "success" | "error" | "info";
  message: string;
};

export default function LeagueManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Referees
  const [referees, setReferees] = useState<Referee[]>([]);
  const [refereeForm, setRefereeForm] = useState<RefereeFormState>({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [refereeFormVisible, setRefereeFormVisible] = useState(false);
  const [refereeSubmitting, setRefereeSubmitting] = useState(false);
  const [refereeStatus, setRefereeStatus] = useState<StatusMessage | null>(null);

  // Venues
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueForm, setVenueForm] = useState<VenueFormState>({
    name: "",
    address: "",
    city: "",
    capacity: "",
  });
  const [venueFormVisible, setVenueFormVisible] = useState(false);
  const [venueSubmitting, setVenueSubmitting] = useState(false);
  const [venueStatus, setVenueStatus] = useState<StatusMessage | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"referees" | "venues">("referees");

  // Check authentication and permissions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const adminUser = await getAdminUser(firebaseUser.uid);
          if (!adminUser) {
            router.push("/admin");
            return;
          }

          setPermissions(adminUser.permissions);

          // Check if user has league management permissions
          if (!adminUser.permissions.canManageReferees && !adminUser.permissions.canManageVenues) {
            router.push("/admin");
            return;
          }
        } catch (error) {
          console.error("Error fetching admin user:", error);
          router.push("/admin");
        }
      } else {
        router.push("/admin");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Load referees
  useEffect(() => {
    if (!permissions?.canManageReferees) return;

    const refereesQuery = query(
      collection(firebaseDB, "referees"),
      orderBy("lastName", "asc")
    );

    const unsubscribe = onSnapshot(refereesQuery, (snapshot) => {
      setReferees(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          firstName: doc.data().firstName || "",
          lastName: doc.data().lastName || "",
          phone: doc.data().phone || "",
          headshotUrl: doc.data().headshotUrl,
          createdAt: doc.data().createdAt?.toDate() || null,
        }))
      );
    });

    return () => unsubscribe();
  }, [permissions]);

  // Load venues
  useEffect(() => {
    if (!permissions?.canManageVenues) return;

    const venuesQuery = query(
      collection(firebaseDB, "venues"),
      orderBy("name", "asc")
    );

    const unsubscribe = onSnapshot(venuesQuery, (snapshot) => {
      setVenues(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "",
          address: doc.data().address,
          city: doc.data().city,
          capacity: doc.data().capacity,
          createdAt: doc.data().createdAt?.toDate() || null,
        }))
      );
    });

    return () => unsubscribe();
  }, [permissions]);

  // Referee handlers
  const handleSubmitReferee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setRefereeStatus({ type: "error", message: "Not authenticated" });
      return;
    }

    const { firstName, lastName, phone, headshotFile } = refereeForm;

    if (!firstName.trim() || !lastName.trim()) {
      setRefereeStatus({ type: "error", message: "First and last name are required" });
      return;
    }

    if (phone && !isValidPhoneNumber(phone)) {
      setRefereeStatus({
        type: "error",
        message: "Invalid phone number. Include country code (e.g., +1, +237)",
      });
      return;
    }

    setRefereeSubmitting(true);
    setRefereeStatus({ type: "info", message: "Saving referee..." });

    try {
      const normalizedPhone = phone ? normalizePhoneNumber(phone) : "";
      let headshotUrl: string | undefined;

      // Upload headshot if provided
      if (headshotFile) {
        const fileName = `referees/${Date.now()}_${headshotFile.name}`;
        const fileRef = storageRef(firebaseStorage, fileName);
        await uploadBytes(fileRef, headshotFile);
        headshotUrl = await getDownloadURL(fileRef);
      }

      const refereeData: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalizedPhone || null,
        ...(headshotUrl && { headshotUrl }),
      };

      if (refereeForm.id) {
        // Update existing referee
        await updateDoc(doc(firebaseDB, "referees", refereeForm.id), refereeData);
        await logAuditAction(
          "referee_updated",
          user.uid,
          user.email || "unknown",
          "referee",
          refereeForm.id,
          `${firstName} ${lastName}`
        );
        setRefereeStatus({ type: "success", message: "Referee updated successfully" });
      } else {
        // Create new referee
        refereeData.createdAt = serverTimestamp();
        const newRef = await addDoc(collection(firebaseDB, "referees"), refereeData);
        await logAuditAction(
          "referee_added",
          user.uid,
          user.email || "unknown",
          "referee",
          newRef.id,
          `${firstName} ${lastName}`
        );
        setRefereeStatus({ type: "success", message: "Referee added successfully" });
      }

      // Reset form
      setRefereeForm({ firstName: "", lastName: "", phone: "" });
      setRefereeFormVisible(false);
    } catch (error) {
      console.error("Error saving referee:", error);
      setRefereeStatus({ type: "error", message: "Failed to save referee" });
    } finally {
      setRefereeSubmitting(false);
    }
  };

  const handleEditReferee = (referee: Referee) => {
    setRefereeForm({
      id: referee.id,
      firstName: referee.firstName,
      lastName: referee.lastName,
      phone: referee.phone,
    });
    setRefereeFormVisible(true);
  };

  const handleDeleteReferee = async (referee: Referee) => {
    if (!user) return;
    if (!window.confirm(`Delete referee ${referee.firstName} ${referee.lastName}?`)) {
      return;
    }

    setRefereeStatus({ type: "info", message: "Deleting referee..." });

    try {
      // Delete headshot if exists
      if (referee.headshotUrl) {
        try {
          const fileRef = storageRef(firebaseStorage, referee.headshotUrl);
          await deleteObject(fileRef);
        } catch (err) {
          console.error("Error deleting headshot:", err);
        }
      }

      await deleteDoc(doc(firebaseDB, "referees", referee.id));
      await logAuditAction(
        "referee_deleted",
        user.uid,
        user.email || "unknown",
        "referee",
        referee.id,
        `${referee.firstName} ${referee.lastName}`
      );
      setRefereeStatus({ type: "success", message: "Referee deleted successfully" });
    } catch (error) {
      console.error("Error deleting referee:", error);
      setRefereeStatus({ type: "error", message: "Failed to delete referee" });
    }
  };

  // Venue handlers
  const handleSubmitVenue = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setVenueStatus({ type: "error", message: "Not authenticated" });
      return;
    }

    const { name, address, city, capacity } = venueForm;

    if (!name.trim()) {
      setVenueStatus({ type: "error", message: "Venue name is required" });
      return;
    }

    setVenueSubmitting(true);
    setVenueStatus({ type: "info", message: "Saving venue..." });

    try {
      const venueData: any = {
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
      };

      if (venueForm.id) {
        // Update existing venue
        await updateDoc(doc(firebaseDB, "venues", venueForm.id), venueData);
        await logAuditAction(
          "venue_updated",
          user.uid,
          user.email || "unknown",
          "venue",
          venueForm.id,
          name
        );
        setVenueStatus({ type: "success", message: "Venue updated successfully" });
      } else {
        // Create new venue
        venueData.createdAt = serverTimestamp();
        const newRef = await addDoc(collection(firebaseDB, "venues"), venueData);
        await logAuditAction(
          "venue_added",
          user.uid,
          user.email || "unknown",
          "venue",
          newRef.id,
          name
        );
        setVenueStatus({ type: "success", message: "Venue added successfully" });
      }

      // Reset form
      setVenueForm({ name: "", address: "", city: "", capacity: "" });
      setVenueFormVisible(false);
    } catch (error) {
      console.error("Error saving venue:", error);
      setVenueStatus({ type: "error", message: "Failed to save venue" });
    } finally {
      setVenueSubmitting(false);
    }
  };

  const handleEditVenue = (venue: Venue) => {
    setVenueForm({
      id: venue.id,
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      capacity: venue.capacity ? venue.capacity.toString() : "",
    });
    setVenueFormVisible(true);
  };

  const handleDeleteVenue = async (venue: Venue) => {
    if (!user) return;
    if (!window.confirm(`Delete venue ${venue.name}?`)) {
      return;
    }

    setVenueStatus({ type: "info", message: "Deleting venue..." });

    try {
      await deleteDoc(doc(firebaseDB, "venues", venue.id));
      await logAuditAction(
        "venue_deleted",
        user.uid,
        user.email || "unknown",
        "venue",
        venue.id,
        venue.name
      );
      setVenueStatus({ type: "success", message: "Venue deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue:", error);
      setVenueStatus({ type: "error", message: "Failed to delete venue" });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1089D3" }}>
          League Management
        </h1>
        <button
          onClick={() => router.push("/admin")}
          style={{
            padding: "10px 20px",
            background: "#666",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ← Back to Admin
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "2px solid #eee" }}>
        {permissions?.canManageReferees && (
          <button
            onClick={() => setActiveTab("referees")}
            style={{
              padding: "12px 24px",
              background: activeTab === "referees" ? "#1089D3" : "transparent",
              color: activeTab === "referees" ? "white" : "#666",
              border: "none",
              borderBottom: activeTab === "referees" ? "3px solid #1089D3" : "none",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: activeTab === "referees" ? "bold" : "normal",
            }}
          >
            Referees ({referees.length})
          </button>
        )}
        {permissions?.canManageVenues && (
          <button
            onClick={() => setActiveTab("venues")}
            style={{
              padding: "12px 24px",
              background: activeTab === "venues" ? "#1089D3" : "transparent",
              color: activeTab === "venues" ? "white" : "#666",
              border: "none",
              borderBottom: activeTab === "venues" ? "3px solid #1089D3" : "none",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: activeTab === "venues" ? "bold" : "normal",
            }}
          >
            Venues ({venues.length})
          </button>
        )}
      </div>

      {/* Referees Tab */}
      {activeTab === "referees" && permissions?.canManageReferees && (
        <div>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "bold" }}>Referees</h2>
            <button
              onClick={() => {
                setRefereeForm({ firstName: "", lastName: "", phone: "" });
                setRefereeFormVisible(true);
              }}
              style={{
                padding: "10px 20px",
                background: "#1089D3",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add Referee
            </button>
          </div>

          {refereeStatus && (
            <div
              style={{
                padding: "12px",
                marginBottom: "20px",
                borderRadius: "8px",
                background:
                  refereeStatus.type === "success"
                    ? "#d4edda"
                    : refereeStatus.type === "error"
                    ? "#f8d7da"
                    : "#d1ecf1",
                color:
                  refereeStatus.type === "success"
                    ? "#155724"
                    : refereeStatus.type === "error"
                    ? "#721c24"
                    : "#0c5460",
              }}
            >
              {refereeStatus.message}
            </div>
          )}

          {refereeFormVisible && (
            <div
              style={{
                background: "#f8f9fa",
                padding: "20px",
                borderRadius: "12px",
                marginBottom: "30px",
                border: "2px solid #1089D3",
              }}
            >
              <h3 style={{ marginBottom: "15px", fontSize: "18px", fontWeight: "bold" }}>
                {refereeForm.id ? "Edit Referee" : "Add New Referee"}
              </h3>
              <form onSubmit={handleSubmitReferee}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={refereeForm.firstName}
                      onChange={(e) => setRefereeForm({ ...refereeForm, firstName: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={refereeForm.lastName}
                      onChange={(e) => setRefereeForm({ ...refereeForm, lastName: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={refereeForm.phone}
                    onChange={(e) => setRefereeForm({ ...refereeForm, phone: e.target.value })}
                    placeholder="+237 XXX XXX XXX"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      fontSize: "14px",
                    }}
                  />
                  <small style={{ color: "#666", fontSize: "12px" }}>
                    Include country code (e.g., +1 for US, +237 for Cameroon)
                  </small>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Headshot Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setRefereeForm({ ...refereeForm, headshotFile: file });
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="submit"
                    disabled={refereeSubmitting}
                    style={{
                      padding: "12px 24px",
                      background: refereeSubmitting ? "#ccc" : "#1089D3",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: refereeSubmitting ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {refereeSubmitting ? "Saving..." : refereeForm.id ? "Update Referee" : "Add Referee"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefereeForm({ firstName: "", lastName: "", phone: "" });
                      setRefereeFormVisible(false);
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Referees List */}
          <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            {referees.length === 0 ? (
              <p style={{ textAlign: "center", color: "#666", padding: "40px" }}>
                No referees added yet. Click "Add Referee" to get started.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Photo</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Name</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Phone</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Added</th>
                      <th style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referees.map((referee) => (
                      <tr key={referee.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px" }}>
                          {referee.headshotUrl ? (
                            <img
                              src={referee.headshotUrl}
                              alt={`${referee.firstName} ${referee.lastName}`}
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                background: "#ddd",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                fontWeight: "bold",
                                color: "#666",
                              }}
                            >
                              {referee.firstName[0]}
                              {referee.lastName[0]}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {referee.firstName} {referee.lastName}
                        </td>
                        <td style={{ padding: "12px" }}>{referee.phone || "-"}</td>
                        <td style={{ padding: "12px" }}>
                          {referee.createdAt ? referee.createdAt.toLocaleDateString() : "-"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <button
                            onClick={() => handleEditReferee(referee)}
                            style={{
                              padding: "6px 12px",
                              background: "#1089D3",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              marginRight: "8px",
                              fontSize: "14px",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReferee(referee)}
                            style={{
                              padding: "6px 12px",
                              background: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Venues Tab */}
      {activeTab === "venues" && permissions?.canManageVenues && (
        <div>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "bold" }}>Venues</h2>
            <button
              onClick={() => {
                setVenueForm({ name: "", address: "", city: "", capacity: "" });
                setVenueFormVisible(true);
              }}
              style={{
                padding: "10px 20px",
                background: "#1089D3",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add Venue
            </button>
          </div>

          {venueStatus && (
            <div
              style={{
                padding: "12px",
                marginBottom: "20px",
                borderRadius: "8px",
                background:
                  venueStatus.type === "success"
                    ? "#d4edda"
                    : venueStatus.type === "error"
                    ? "#f8d7da"
                    : "#d1ecf1",
                color:
                  venueStatus.type === "success"
                    ? "#155724"
                    : venueStatus.type === "error"
                    ? "#721c24"
                    : "#0c5460",
              }}
            >
              {venueStatus.message}
            </div>
          )}

          {venueFormVisible && (
            <div
              style={{
                background: "#f8f9fa",
                padding: "20px",
                borderRadius: "12px",
                marginBottom: "30px",
                border: "2px solid #1089D3",
              }}
            >
              <h3 style={{ marginBottom: "15px", fontSize: "18px", fontWeight: "bold" }}>
                {venueForm.id ? "Edit Venue" : "Add New Venue"}
              </h3>
              <form onSubmit={handleSubmitVenue}>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Venue Name *
                  </label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={venueForm.address}
                      onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={venueForm.city}
                      onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })}
                    min="0"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="submit"
                    disabled={venueSubmitting}
                    style={{
                      padding: "12px 24px",
                      background: venueSubmitting ? "#ccc" : "#1089D3",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: venueSubmitting ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {venueSubmitting ? "Saving..." : venueForm.id ? "Update Venue" : "Add Venue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVenueForm({ name: "", address: "", city: "", capacity: "" });
                      setVenueFormVisible(false);
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Venues List */}
          <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            {venues.length === 0 ? (
              <p style={{ textAlign: "center", color: "#666", padding: "40px" }}>
                No venues added yet. Click "Add Venue" to get started.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Name</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>City</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Address</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Capacity</th>
                      <th style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((venue) => (
                      <tr key={venue.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px", fontWeight: "bold" }}>{venue.name}</td>
                        <td style={{ padding: "12px" }}>{venue.city || "-"}</td>
                        <td style={{ padding: "12px" }}>{venue.address || "-"}</td>
                        <td style={{ padding: "12px" }}>
                          {venue.capacity ? venue.capacity.toLocaleString() : "-"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <button
                            onClick={() => handleEditVenue(venue)}
                            style={{
                              padding: "6px 12px",
                              background: "#1089D3",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              marginRight: "8px",
                              fontSize: "14px",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVenue(venue)}
                            style={{
                              padding: "6px 12px",
                              background: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
