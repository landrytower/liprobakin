"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAdmin } from "../../layout";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

type Venue = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  capacity?: number;
  photo?: string;
  createdAt?: Date;
};

const translations = {
  en: {
    title: "Venues Management",
    subtitle: "Manage game venues and sites",
    add: "Add Venue",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    name: "Venue Name",
    address: "Address",
    city: "City",
    capacity: "Capacity",
    photo: "Photo",
    noVenues: "No venues added yet",
    addFirst: "Add your first venue to get started",
    confirmDelete: "Are you sure you want to delete this venue?",
  },
  fr: {
    title: "Gestion des Sites",
    subtitle: "Gérer les sites et lieux de jeu",
    add: "Ajouter un Site",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    name: "Nom du Site",
    address: "Adresse",
    city: "Ville",
    capacity: "Capacité",
    photo: "Photo",
    noVenues: "Aucun site ajouté",
    addFirst: "Ajoutez votre premier site pour commencer",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce site?",
  },
};

export default function VenuesPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    capacity: "",
  });

  // Load venues
  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const snapshot = await getDocs(collection(firebaseDB, "venues"));
      const venuesData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          address: data.address,
          city: data.city,
          capacity: data.capacity,
          photo: data.photoUrl,
          createdAt: data.createdAt?.toDate(),
        };
      });
      setVenues(venuesData);
    } catch (error) {
      console.error("Error loading venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let photoUrl = "";
      
      // Upload photo if provided
      if (imageFile) {
        const photoRef = storageRef(firebaseStorage, `venues/${Date.now()}-${imageFile.name}`);
        await uploadBytes(photoRef, imageFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      const venueData: any = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        ...(photoUrl && { photoUrl }),
      };

      if (editingVenue) {
        // Update existing venue
        await updateDoc(doc(firebaseDB, "venues", editingVenue.id), venueData);
      } else {
        // Create new venue
        venueData.createdAt = serverTimestamp();
        await addDoc(collection(firebaseDB, "venues"), venueData);
      }

      setShowForm(false);
      setEditingVenue(null);
      setForm({ name: "", address: "", city: "", capacity: "" });
      setImageFile(null);
      loadVenues();
    } catch (error) {
      console.error("Error saving venue:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (venueId: string) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      await deleteDoc(doc(firebaseDB, "venues", venueId));
      loadVenues();
    } catch (error) {
      console.error("Error deleting venue:", error);
    }
  };

  const openEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setForm({
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      capacity: venue.capacity ? venue.capacity.toString() : "",
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link 
        href="/admin/league"
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {language === 'fr' ? 'Retour à la gestion' : 'Back to management'}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 text-sm">{t.subtitle}</p>
        </div>
        <button
          onClick={() => {
            setEditingVenue(null);
            setForm({
              name: "",
              address: "",
              city: "",
              capacity: "",
            });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          {t.add}
        </button>
      </div>

      {/* Venues Grid */}
      {venues.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-white/10">
          <p className="text-4xl mb-4">🏟️</p>
          <p className="text-white font-semibold">{t.noVenues}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="bg-slate-800/50 rounded-2xl border border-white/10 p-4 hover:border-orange-500/30 transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                {venue.photo ? (
                  <Image
                    src={venue.photo}
                    alt={venue.name}
                    width={56}
                    height={56}
                    className="rounded-lg object-cover bg-white p-1"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
                    🏟️
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{venue.name}</p>
                  {venue.city && (
                    <p className="text-xs text-slate-400 mt-1">{venue.city}</p>
                  )}
                  {venue.capacity && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                      {venue.capacity.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              {venue.address && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{venue.address}</p>
              )}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(venue)}
                  className="flex-1 py-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700"
                >
                  {t.edit}
                </button>
                <button
                  onClick={() => handleDelete(venue.id)}
                  className="flex-1 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {editingVenue ? t.edit : t.add}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.name}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.city}</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.capacity}</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.photo}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-400"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/10 bg-slate-800/30">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 rounded-xl transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl hover:shadow-lg disabled:opacity-50"
              >
                {saving ? "..." : t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}