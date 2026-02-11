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

type CommitteeMember = {
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
    title: "Committee Management",
    subtitle: "Manage committee members",
    add: "Add Member",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    firstName: "First Name",
    lastName: "Last Name",
    role: "Role/Position",
    phone: "Phone",
    email: "Email",
    photo: "Photo",
    bio: "Biography",
    department: "Department",
    noMembers: "No committee members added yet",
    addFirst: "Add your first committee member to get started",
    confirmDelete: "Are you sure you want to delete this member?",
    roles: {
      president: "President",
      vicePresident: "Vice President",
      secretary: "Secretary",
      treasurer: "Treasurer",
      member: "Member",
    },
  },
  fr: {
    title: "Gestion du Comité",
    subtitle: "Gérer les membres du comité",
    add: "Ajouter un Membre",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    firstName: "Prénom",
    lastName: "Nom",
    role: "Rôle/Position",
    phone: "Téléphone",
    email: "Email",
    photo: "Photo",
    bio: "Biographie",
    department: "Département",
    noMembers: "Aucun membre du comité ajouté",
    addFirst: "Ajoutez votre premier membre du comité pour commencer",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce membre?",
    roles: {
      president: "Président",
      vicePresident: "Vice-Président",
      secretary: "Secrétaire",
      treasurer: "Trésorier",
      member: "Membre",
    },
  },
};

export default function CommitteePage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMember | null>(null);
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const snapshot = await getDocs(collection(firebaseDB, "committeeMembers"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CommitteeMember));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching committee members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let photoUrl = editingMember?.photo || "";

      if (imageFile) {
        const imgRef = storageRef(firebaseStorage, `committee/${Date.now()}_${imageFile.name}`);
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
        await updateDoc(doc(firebaseDB, "committeeMembers", editingMember.id), data);
      } else {
        await addDoc(collection(firebaseDB, "committeeMembers"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setShowForm(false);
      setEditingMember(null);
      setForm({ firstName: "", lastName: "", role: "", phone: "", email: "", bio: "", department: "" });
      setImageFile(null);
      fetchMembers();
    } catch (error) {
      console.error("Error saving committee member:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(firebaseDB, "committeeMembers", id));
      fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
    }
  };

  const openEdit = (member: CommitteeMember) => {
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
            setShowForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          {t.add}
        </button>
      </div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-white/10">
          <p className="text-4xl mb-4">👔</p>
          <p className="text-white font-semibold">{t.noMembers}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-slate-800/50 rounded-2xl border border-white/10 p-4 hover:border-orange-500/30 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={`${member.firstName} ${member.lastName}`}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                    👔
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-orange-400">{member.role}</p>
                </div>
              </div>
              {member.department && (
                <p className="text-xs text-slate-400 mb-2">{member.department}</p>
              )}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(member)}
                  className="flex-1 py-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700"
                >
                  {t.edit}
                </button>
                <button
                  onClick={() => handleDelete(member.id)}
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
                {editingMember ? t.edit : t.add}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.firstName}</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.lastName}</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.role}</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                  placeholder="President, Vice President, Secretary..."
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.phone}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.email}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.department}</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.bio}</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm resize-none"
                />
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
