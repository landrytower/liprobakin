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

type Partner = {
  id: string;
  name: string;
  description?: string;
  website?: string;
  logo?: string;
  tier?: "platinum" | "gold" | "silver" | "bronze";
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt?: Date;
};

const translations = {
  en: {
    title: "Partners Management",
    subtitle: "Manage league sponsors and partners",
    add: "Add Partner",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    name: "Partner Name",
    description: "Description",
    website: "Website",
    logo: "Logo",
    tier: "Sponsorship Tier",
    contactName: "Contact Name",
    contactEmail: "Contact Email",
    contactPhone: "Contact Phone",
    noPartners: "No partners added yet",
    addFirst: "Add your first partner to get started",
    confirmDelete: "Are you sure you want to delete this partner?",
    tiers: {
      platinum: "Platinum",
      gold: "Gold",
      silver: "Silver",
      bronze: "Bronze",
    },
  },
  fr: {
    title: "Gestion des Partenaires",
    subtitle: "Gérer les sponsors et partenaires de la ligue",
    add: "Ajouter un Partenaire",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    name: "Nom du Partenaire",
    description: "Description",
    website: "Site Web",
    logo: "Logo",
    tier: "Niveau de Parrainage",
    contactName: "Nom du Contact",
    contactEmail: "Email du Contact",
    contactPhone: "Téléphone du Contact",
    noPartners: "Aucun partenaire ajouté",
    addFirst: "Ajoutez votre premier partenaire pour commencer",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce partenaire?",
    tiers: {
      platinum: "Platine",
      gold: "Or",
      silver: "Argent",
      bronze: "Bronze",
    },
  },
};

const tierColors = {
  platinum: "from-slate-300 to-slate-400",
  gold: "from-yellow-400 to-amber-500",
  silver: "from-slate-400 to-slate-500",
  bronze: "from-orange-600 to-amber-700",
};

export default function PartnersPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    website: "",
    tier: "bronze" as Partner["tier"],
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const snapshot = await getDocs(collection(firebaseDB, "partners"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Partner));
      // Sort by tier
      const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
      data.sort((a, b) => (tierOrder[a.tier || "bronze"] || 4) - (tierOrder[b.tier || "bronze"] || 4));
      setPartners(data);
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = editingPartner?.logo || "";

      if (imageFile) {
        const imgRef = storageRef(firebaseStorage, `partners/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imgRef, imageFile);
        logoUrl = await getDownloadURL(imgRef);
      }

      const data = {
        name: form.name,
        description: form.description,
        website: form.website,
        tier: form.tier,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        logo: logoUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingPartner) {
        await updateDoc(doc(firebaseDB, "partners", editingPartner.id), data);
      } else {
        await addDoc(collection(firebaseDB, "partners"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setShowForm(false);
      setEditingPartner(null);
      setForm({
        name: "",
        description: "",
        website: "",
        tier: "bronze",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      });
      setImageFile(null);
      fetchPartners();
    } catch (error) {
      console.error("Error saving partner:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(firebaseDB, "partners", id));
      fetchPartners();
    } catch (error) {
      console.error("Error deleting partner:", error);
    }
  };

  const openEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setForm({
      name: partner.name,
      description: partner.description || "",
      website: partner.website || "",
      tier: partner.tier || "bronze",
      contactName: partner.contactName || "",
      contactEmail: partner.contactEmail || "",
      contactPhone: partner.contactPhone || "",
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
            setEditingPartner(null);
            setForm({
              name: "",
              description: "",
              website: "",
              tier: "bronze",
              contactName: "",
              contactEmail: "",
              contactPhone: "",
            });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          {t.add}
        </button>
      </div>

      {/* Partners Grid */}
      {partners.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-white/10">
          <p className="text-4xl mb-4">🤝</p>
          <p className="text-white font-semibold">{t.noPartners}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-slate-800/50 rounded-2xl border border-white/10 p-4 hover:border-orange-500/30 transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                {partner.logo ? (
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    width={56}
                    height={56}
                    className="rounded-lg object-contain bg-white p-1"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
                    🤝
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{partner.name}</p>
                  {partner.tier && (
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r ${tierColors[partner.tier]} text-white`}
                    >
                      {t.tiers[partner.tier]}
                    </span>
                  )}
                </div>
              </div>
              {partner.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{partner.description}</p>
              )}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(partner)}
                  className="flex-1 py-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700"
                >
                  {t.edit}
                </button>
                <button
                  onClick={() => handleDelete(partner.id)}
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
                {editingPartner ? t.edit : t.add}
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
                <label className="block text-xs text-slate-400 mb-1">{t.tier}</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as Partner["tier"] })}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="platinum">{t.tiers.platinum}</option>
                  <option value="gold">{t.tiers.gold}</option>
                  <option value="silver">{t.tiers.silver}</option>
                  <option value="bronze">{t.tiers.bronze}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.description}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.website}</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.contactName}</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.contactPhone}</label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.contactEmail}</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.logo}</label>
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
