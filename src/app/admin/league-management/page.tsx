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

      const refereeData: Record<string, unknown> = {
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
      const venueData: Record<string, unknown> = {
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
      <div className="p-10 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1089D3]">
          League Management
        </h1>
        <button
          onClick={() => router.push("/admin")}
          className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gray-500 text-white rounded-lg cursor-pointer hover:bg-gray-600 transition text-sm sm:text-base"
        >
          ← Back to Admin
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 sm:gap-2.5 mb-6 sm:mb-8 border-b-2 border-gray-200 overflow-x-auto">
        {permissions?.canManageReferees && (
          <button
            onClick={() => setActiveTab("referees")}
            className={`px-6 py-3 text-base cursor-pointer transition ${
              activeTab === "referees"
                ? "bg-[#1089D3] text-white font-bold border-b-[3px] border-[#1089D3]"
                : "bg-transparent text-gray-500"
            }`}
          >
            Referees ({referees.length})
          </button>
        )}
        {permissions?.canManageVenues && (
          <button
            onClick={() => setActiveTab("venues")}
            className={`px-6 py-3 text-base cursor-pointer transition ${
              activeTab === "venues"
                ? "bg-[#1089D3] text-white font-bold border-b-[3px] border-[#1089D3]"
                : "bg-transparent text-gray-500"
            }`}
          >
            Venues ({venues.length})
          </button>
        )}
      </div>

      {/* Referees Tab */}
      {activeTab === "referees" && permissions?.canManageReferees && (
        <div>
          <div className="mb-5 flex justify-between items-center">
            <h2 className="text-xl font-bold">Referees</h2>
            <button
              onClick={() => {
                setRefereeForm({ firstName: "", lastName: "", phone: "" });
                setRefereeFormVisible(true);
              }}
              className="px-5 py-2.5 bg-[#1089D3] text-white rounded-lg cursor-pointer font-bold hover:bg-[#0d7ac0] transition"
            >
              + Add Referee
            </button>
          </div>

          {refereeStatus && (
            <div
              className={`p-3 mb-5 rounded-lg ${
                refereeStatus.type === "success"
                  ? "bg-green-100 text-green-800"
                  : refereeStatus.type === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {refereeStatus.message}
            </div>
          )}

          {refereeFormVisible && (
            <div className="bg-gray-50 p-5 rounded-xl mb-8 border-2 border-[#1089D3]">
              <h3 className="mb-4 text-lg font-bold">
                {refereeForm.id ? "Edit Referee" : "Add New Referee"}
              </h3>
              <form onSubmit={handleSubmitReferee}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 font-bold text-sm">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={refereeForm.firstName}
                      onChange={(e) => setRefereeForm({ ...refereeForm, firstName: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-bold text-sm">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={refereeForm.lastName}
                      onChange={(e) => setRefereeForm({ ...refereeForm, lastName: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block mb-1 font-bold text-sm">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={refereeForm.phone}
                    onChange={(e) => setRefereeForm({ ...refereeForm, phone: e.target.value })}
                    placeholder="+237 XXX XXX XXX"
                    className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                  />
                  <small className="text-gray-500 text-xs">
                    Include country code (e.g., +1 for US, +237 for Cameroon)
                  </small>
                </div>

                <div className="mb-4">
                  <label className="block mb-1 font-bold text-sm">
                    Headshot Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setRefereeForm({ ...refereeForm, headshotFile: file });
                    }}
                    className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="submit"
                    disabled={refereeSubmitting}
                    className={`px-6 py-3 text-white rounded-lg font-bold transition ${
                      refereeSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#1089D3] cursor-pointer hover:bg-[#0d7ac0]"
                    }`}
                  >
                    {refereeSubmitting ? "Saving..." : refereeForm.id ? "Update Referee" : "Add Referee"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefereeForm({ firstName: "", lastName: "", phone: "" });
                      setRefereeFormVisible(false);
                    }}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg cursor-pointer hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Referees List */}
          <div className="bg-white rounded-xl p-3 sm:p-5 shadow-md">
            {referees.length === 0 ? (
              <p className="text-center text-gray-500 py-10">
                No referees added yet. Click &quot;Add Referee&quot; to get started.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="p-3 text-left font-bold">Photo</th>
                      <th className="p-3 text-left font-bold">Name</th>
                      <th className="p-3 text-left font-bold">Phone</th>
                      <th className="p-3 text-left font-bold">Added</th>
                      <th className="p-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referees.map((referee) => (
                      <tr key={referee.id} className="border-b border-gray-200">
                        <td className="p-3">
                          {referee.headshotUrl ? (
                            <img
                              src={referee.headshotUrl}
                              alt={`${referee.firstName} ${referee.lastName}`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-xl font-bold text-gray-600">
                              {referee.firstName[0]}
                              {referee.lastName[0]}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {referee.firstName} {referee.lastName}
                        </td>
                        <td className="p-3">{referee.phone || "-"}</td>
                        <td className="p-3">
                          {referee.createdAt ? referee.createdAt.toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleEditReferee(referee)}
                            className="px-3 py-1.5 bg-[#1089D3] text-white rounded-md cursor-pointer mr-2 text-sm hover:bg-[#0d7ac0] transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReferee(referee)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-md cursor-pointer text-sm hover:bg-red-600 transition"
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
          <div className="mb-5 flex justify-between items-center">
            <h2 className="text-xl font-bold">Venues</h2>
            <button
              onClick={() => {
                setVenueForm({ name: "", address: "", city: "", capacity: "" });
                setVenueFormVisible(true);
              }}
              className="px-5 py-2.5 bg-[#1089D3] text-white rounded-lg cursor-pointer font-bold hover:bg-[#0d7ac0] transition"
            >
              + Add Venue
            </button>
          </div>

          {venueStatus && (
            <div
              className={`p-3 mb-5 rounded-lg ${
                venueStatus.type === "success"
                  ? "bg-green-100 text-green-800"
                  : venueStatus.type === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {venueStatus.message}
            </div>
          )}

          {venueFormVisible && (
            <div className="bg-gray-50 p-5 rounded-xl mb-8 border-2 border-[#1089D3]">
              <h3 className="mb-4 text-lg font-bold">
                {venueForm.id ? "Edit Venue" : "Add New Venue"}
              </h3>
              <form onSubmit={handleSubmitVenue}>
                <div className="mb-4">
                  <label className="block mb-1 font-bold text-sm">
                    Venue Name *
                  </label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block mb-1 font-bold text-sm">
                      Address
                    </label>
                    <input
                      type="text"
                      value={venueForm.address}
                      onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-bold text-sm">
                      City
                    </label>
                    <input
                      type="text"
                      value={venueForm.city}
                      onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block mb-1 font-bold text-sm">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })}
                    min="0"
                    className="w-full p-2.5 rounded-lg border border-gray-300 text-sm"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="submit"
                    disabled={venueSubmitting}
                    className={`px-6 py-3 text-white rounded-lg font-bold transition ${
                      venueSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#1089D3] cursor-pointer hover:bg-[#0d7ac0]"
                    }`}
                  >
                    {venueSubmitting ? "Saving..." : venueForm.id ? "Update Venue" : "Add Venue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVenueForm({ name: "", address: "", city: "", capacity: "" });
                      setVenueFormVisible(false);
                    }}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg cursor-pointer hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Venues List */}
          <div className="bg-white rounded-xl p-3 sm:p-5 shadow-md">
            {venues.length === 0 ? (
              <p className="text-center text-gray-500 py-10">
                No venues added yet. Click &quot;Add Venue&quot; to get started.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="p-3 text-left font-bold">Name</th>
                      <th className="p-3 text-left font-bold">City</th>
                      <th className="p-3 text-left font-bold">Address</th>
                      <th className="p-3 text-left font-bold">Capacity</th>
                      <th className="p-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((venue) => (
                      <tr key={venue.id} className="border-b border-gray-200">
                        <td className="p-3 font-bold">{venue.name}</td>
                        <td className="p-3">{venue.city || "-"}</td>
                        <td className="p-3">{venue.address || "-"}</td>
                        <td className="p-3">
                          {venue.capacity ? venue.capacity.toLocaleString() : "-"}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleEditVenue(venue)}
                            className="px-3 py-1.5 bg-[#1089D3] text-white rounded-md cursor-pointer mr-2 text-sm hover:bg-[#0d7ac0] transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVenue(venue)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-md cursor-pointer text-sm hover:bg-red-600 transition"
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
