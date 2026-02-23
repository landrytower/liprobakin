"use client";

import React, { useEffect, useState, useRef } from "react";
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
    choosePhoto: "Choose Photo",
    dragDrop: "or drag and drop",
    newVenue: "New Venue",
    editVenue: "Edit Venue",
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
    choosePhoto: "Choisir une Photo",
    dragDrop: "ou glisser-déposer",
    newVenue: "Nouveau Site",
    editVenue: "Modifier le Site",
  },
};

export default function VenuesPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    capacity: "",
  });

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const snapshot = await getDocs(collection(firebaseDB, "venues"));
      const venuesData = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
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

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    
    setSaving(true);

    try {
      let photoUrl = "";
      
      if (imageFile) {
        const photoRef = storageRef(firebaseStorage, `venues/${Date.now()}-${imageFile.name}`);
        await uploadBytes(photoRef, imageFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      const venueData: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        updatedAt: serverTimestamp(),
      };

      if (photoUrl) {
        venueData.photoUrl = photoUrl;
      }

      if (editingVenueId) {
        await updateDoc(doc(firebaseDB, "venues", editingVenueId), venueData);
      } else {
        venueData.createdAt = serverTimestamp();
        await addDoc(collection(firebaseDB, "venues"), venueData);
      }

      resetForm();
      loadVenues();
    } catch (error) {
      console.error("Error saving venue:", error);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowInlineForm(false);
    setEditingVenueId(null);
    setForm({ name: "", address: "", city: "", capacity: "" });
    setImageFile(null);
    setImagePreview("");
  };

  const openEdit = (venue: Venue) => {
    setEditingVenueId(venue.id);
    setForm({
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      capacity: venue.capacity ? venue.capacity.toString() : "",
    });
    setImagePreview(venue.photo || "");
    setShowInlineForm(true);
  };

  const openNew = () => {
    resetForm();
    setShowInlineForm(true);
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
        {!showInlineForm && (
          <button
            onClick={openNew}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            {t.add}
          </button>
        )}
      </div>

      {/* Inline Add/Edit Form */}
      {showInlineForm && (
        <form 
          onSubmit={handleSubmit}
          className="bg-slate-800/50 rounded-2xl border border-orange-500/30 p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-white">
              {editingVenueId ? t.editVenue : t.newVenue}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.name} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder={language === "fr" ? "ex. Stade des Martyrs" : "e.g. Martyrs Stadium"}
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.address}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder={language === "fr" ? "ex. Avenue de la Paix" : "e.g. Peace Avenue"}
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.city}</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder={language === "fr" ? "ex. Kinshasa" : "e.g. Kinshasa"}
                    className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.capacity}</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    min="0"
                    placeholder="1000"
                    className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.photo}</label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-xl transition-all ${
                  isDragging 
                    ? "border-orange-500 bg-orange-500/10" 
                    : imagePreview 
                      ? "border-green-500/50 bg-green-500/5" 
                      : "border-white/20 hover:border-white/40"
                }`}
              >
                {imagePreview ? (
                  <div className="relative p-4">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="text-center text-sm text-green-400 mt-3">{imageFile?.name || t.photo}</p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 cursor-pointer p-6">
                    <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-orange-400 mb-1">{t.choosePhoto}</span>
                    <span className="text-xs text-slate-500">{t.dragDrop}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {language === "fr" ? "Enregistrement..." : "Saving..."}
                </span>
              ) : t.save}
            </button>
          </div>
        </form>
      )}

      {/* Venues Grid */}
      {venues.length === 0 && !showInlineForm ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-white/10">
          <p className="text-4xl mb-4">🏟️</p>
          <p className="text-white font-semibold">{t.noVenues}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
          <button
            onClick={openNew}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            {t.add}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className={`bg-slate-800/50 rounded-2xl border p-4 transition-all group ${
                editingVenueId === venue.id 
                  ? "border-orange-500/50 ring-2 ring-orange-500/20" 
                  : "border-white/10 hover:border-orange-500/30"
              }`}
            >
              {venue.photo && (
                <div className="relative h-32 rounded-xl overflow-hidden mb-4 -mx-1 -mt-1">
                  <Image
                    src={venue.photo}
                    alt={venue.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              
              <div className="flex items-start gap-3 mb-3">
                {!venue.photo && (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                    🏟️
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{venue.name}</p>
                  {venue.city && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {venue.city}
                    </p>
                  )}
                  {venue.capacity && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {venue.capacity.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              
              {venue.address && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{venue.address}</p>
              )}
              
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(venue)}
                  className="flex-1 py-2 text-xs font-medium text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t.edit}
                </button>
                <button
                  onClick={() => handleDelete(venue.id)}
                  className="flex-1 py-2 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}