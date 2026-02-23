"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
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

type CommissionMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string;
  phone?: string;
  photo?: string;
  bio?: string;
  department?: string;
  createdAt?: Date;
};

const translations = {
  en: {
    title: "Commission Members",
    subtitle: "Manage operational and technical commission members",
    add: "+ Add Member",
    edit: "Edit",
    delete: "Delete",
    save: "Save Member",
    cancel: "Cancel",
    firstName: "First Name",
    lastName: "Last Name",
    role: "Position / Title",
    phone: "Phone Number",
    email: "Email Address",
    photo: "Profile Photo",
    uploadPhoto: "Upload Photo",
    changePhoto: "Change Photo",
    bio: "Biography",
    department: "Department",
    noMembers: "No commission members yet",
    addFirst: "Add your first commission member to get started",
    confirmDelete: "Are you sure you want to delete this member?",
    dragDrop: "Drag & drop or click to upload",
    imageFormats: "JPG, PNG or WebP (max 5MB)",
  },
  fr: {
    title: "Membres de la Commission",
    subtitle: "Gérer les membres des commissions opérationnelles et techniques",
    add: "+ Ajouter un Membre",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    firstName: "Prénom",
    lastName: "Nom de famille",
    role: "Poste / Titre",
    phone: "Numéro de téléphone",
    email: "Adresse email",
    photo: "Photo de profil",
    uploadPhoto: "Télécharger une photo",
    changePhoto: "Changer la photo",
    bio: "Biographie",
    department: "Département",
    noMembers: "Aucun membre de la commission",
    addFirst: "Ajoutez votre premier membre pour commencer",
    confirmDelete: "Voulez-vous vraiment supprimer ce membre?",
    dragDrop: "Glisser-déposer ou cliquer pour télécharger",
    imageFormats: "JPG, PNG ou WebP (max 5MB)",
  },
};

export default function CommissionPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [members, setMembers] = useState<CommissionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CommissionMember | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    role: "",
    phone: "",
    email: "",
    bio: "",
    department: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const snapshot = await getDocs(collection(firebaseDB, "commission"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CommissionMember));
      // Sort alphabetically by last name
      data.sort((a, b) => a.lastName.localeCompare(b.lastName));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching commission members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let photoUrl = editingMember?.photo || "";

      if (imageFile) {
        const imgRef = storageRef(firebaseStorage, `commission/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imgRef, imageFile);
        photoUrl = await getDownloadURL(imgRef);
      }

      const data = {
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        phone: form.phone,
        email: form.email,
        bio: form.bio,
        department: form.department,
        photo: photoUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingMember) {
        await updateDoc(doc(firebaseDB, "commission", editingMember.id), data);
      } else {
        await addDoc(collection(firebaseDB, "commission"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setShowForm(false);
      setEditingMember(null);
      setForm({ firstName: "", lastName: "", role: "", phone: "", email: "", bio: "", department: "" });
      setImageFile(null);
      setImagePreview("");
      fetchMembers();
    } catch (error) {
      console.error("Error saving commission member:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(firebaseDB, "commission", id));
      fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
    }
  };

  const openEdit = (member: CommissionMember) => {
    setEditingMember(member);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      phone: member.phone || "",
      email: member.email || "",
      bio: member.bio || "",
      department: member.department || "",
    });
    setImagePreview(member.photo || "");
    setImageFile(null);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 text-sm">{t.subtitle}</p>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setForm({ firstName: "", lastName: "", role: "", phone: "", email: "", bio: "", department: "" });
            setImagePreview("");
            setImageFile(null);
            setShowForm(true);
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          {t.add}
        </button>
      </div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-white/10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <span className="text-4xl">📋</span>
          </div>
          <p className="text-white font-semibold text-lg">{t.noMembers}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-white/10 overflow-hidden hover:border-teal-500/40 transition-all hover:shadow-lg hover:shadow-teal-500/10"
            >
              {/* Photo Section */}
              <div className="relative h-32 bg-gradient-to-br from-slate-700 to-slate-800 overflow-hidden">
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={`${member.firstName} ${member.lastName}`}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-slate-600/50 flex items-center justify-center text-2xl font-bold text-slate-400">
                      {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                    </div>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>

              {/* Info Section */}
              <div className="p-3 -mt-6 relative">
                <div className="mb-2">
                  <h3 className="text-sm font-bold text-white truncate">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="text-xs font-medium text-teal-400 uppercase tracking-wide truncate">
                    {member.role}
                  </p>
                </div>

                {member.department && (
                  <p className="text-[10px] text-slate-400 truncate">
                    {member.department}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 pt-2 mt-2 border-t border-white/5">
                  <button
                    onClick={() => openEdit(member)}
                    className="flex-1 py-1.5 text-xs font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition"
                  >
                    {t.delete}
                  </button>
                </div>
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
            className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingMember ? `${t.edit} - ${editingMember.firstName} ${editingMember.lastName}` : t.add}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white transition"
                title={t.cancel}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Photo Upload - Prominent */}
              <div className="flex flex-col items-center">
                <label className="cursor-pointer group">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-slate-800 border-2 border-dashed border-slate-600 group-hover:border-teal-500 transition">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 group-hover:text-teal-400 transition">
                        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">{t.uploadPhoto}</span>
                      </div>
                    )}
                    {imagePreview && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <span className="text-white text-xs font-medium">{t.changePhoto}</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-2">{t.imageFormats}</p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.firstName} *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.lastName} *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.role} *</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                  placeholder="Discipline, Technique, Organisation..."
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.email}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t.phone}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.department}</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition"
                  placeholder="Discipline, Technique, Arbitrage..."
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.bio}</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:border-teal-500 focus:outline-none transition resize-none"
                  placeholder={language === 'fr' ? "Expérience et background du membre..." : "Member's experience and background..."}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 p-6 border-t border-white/10 bg-slate-800/30">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 rounded-xl transition-colors border border-white/10"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl hover:shadow-lg hover:shadow-teal-500/25 disabled:opacity-50 transition-all"
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
