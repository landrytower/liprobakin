"use client";

import React, { useEffect, useState } from "react";
import { useAdmin } from "../../layout";
import { firebaseDB } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

type SalesRecord = {
  id: string;
  type: "ticket" | "merchandise" | "sponsorship" | "other";
  description: string;
  amount: number;
  currency: string;
  date: string;
  customerName?: string;
  customerEmail?: string;
  status: "pending" | "completed" | "refunded";
  notes?: string;
  createdAt?: Date;
};

const translations = {
  en: {
    title: "Sales Management",
    subtitle: "Track revenue and sales transactions",
    add: "Add Sale",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    type: "Type",
    description: "Description",
    amount: "Amount",
    date: "Date",
    customerName: "Customer Name",
    customerEmail: "Customer Email",
    status: "Status",
    notes: "Notes",
    noSales: "No sales recorded yet",
    addFirst: "Record your first sale to get started",
    confirmDelete: "Are you sure you want to delete this sale record?",
    totalRevenue: "Total Revenue",
    thisMonth: "This Month",
    pendingPayments: "Pending",
    types: {
      ticket: "Ticket Sales",
      merchandise: "Merchandise",
      sponsorship: "Sponsorship",
      other: "Other",
    },
    statuses: {
      pending: "Pending",
      completed: "Completed",
      refunded: "Refunded",
    },
  },
  fr: {
    title: "Gestion des Ventes",
    subtitle: "Suivre les revenus et les transactions",
    add: "Ajouter une Vente",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    type: "Type",
    description: "Description",
    amount: "Montant",
    date: "Date",
    customerName: "Nom du Client",
    customerEmail: "Email du Client",
    status: "Statut",
    notes: "Notes",
    noSales: "Aucune vente enregistrée",
    addFirst: "Enregistrez votre première vente pour commencer",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer cette vente?",
    totalRevenue: "Revenus Totaux",
    thisMonth: "Ce Mois",
    pendingPayments: "En Attente",
    types: {
      ticket: "Billets",
      merchandise: "Marchandise",
      sponsorship: "Parrainage",
      other: "Autre",
    },
    statuses: {
      pending: "En Attente",
      completed: "Complété",
      refunded: "Remboursé",
    },
  },
};

const typeIcons = {
  ticket: "🎟️",
  merchandise: "👕",
  sponsorship: "🤝",
  other: "📦",
};

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-300",
  completed: "bg-green-500/20 text-green-300",
  refunded: "bg-red-500/20 text-red-300",
};

export default function SalesPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<SalesRecord | null>(null);
  const [form, setForm] = useState({
    type: "ticket" as SalesRecord["type"],
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    customerEmail: "",
    status: "completed" as SalesRecord["status"],
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const q = query(collection(firebaseDB, "sales"), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SalesRecord));
      setSales(data);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        type: form.type,
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        currency: "USD",
        date: form.date,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        status: form.status,
        notes: form.notes,
        updatedAt: serverTimestamp(),
      };

      if (editingSale) {
        await updateDoc(doc(firebaseDB, "sales", editingSale.id), data);
      } else {
        await addDoc(collection(firebaseDB, "sales"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setShowForm(false);
      setEditingSale(null);
      setForm({
        type: "ticket",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        customerName: "",
        customerEmail: "",
        status: "completed",
        notes: "",
      });
      fetchSales();
    } catch (error) {
      console.error("Error saving sale:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(firebaseDB, "sales", id));
      fetchSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
    }
  };

  const openEdit = (sale: SalesRecord) => {
    setEditingSale(sale);
    setForm({
      type: sale.type,
      description: sale.description,
      amount: sale.amount.toString(),
      date: sale.date,
      customerName: sale.customerName || "",
      customerEmail: sale.customerEmail || "",
      status: sale.status,
      notes: sale.notes || "",
    });
    setShowForm(true);
  };

  // Calculate stats
  const totalRevenue = sales
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.amount, 0);
  const thisMonth = sales.filter((s) => {
    const saleDate = new Date(s.date);
    const now = new Date();
    return (
      s.status === "completed" &&
      saleDate.getMonth() === now.getMonth() &&
      saleDate.getFullYear() === now.getFullYear()
    );
  });
  const thisMonthRevenue = thisMonth.reduce((sum, s) => sum + s.amount, 0);
  const pendingAmount = sales
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.amount, 0);

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
            setEditingSale(null);
            setForm({
              type: "ticket",
              description: "",
              amount: "",
              date: new Date().toISOString().split("T")[0],
              customerName: "",
              customerEmail: "",
              status: "completed",
              notes: "",
            });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
        >
          {t.add}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/10 rounded-2xl border border-emerald-500/30 p-4">
          <p className="text-xs text-emerald-400 mb-1">{t.totalRevenue}</p>
          <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-2xl border border-blue-500/30 p-4">
          <p className="text-xs text-blue-400 mb-1">{t.thisMonth}</p>
          <p className="text-2xl font-bold text-white">${thisMonthRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/10 rounded-2xl border border-yellow-500/30 p-4">
          <p className="text-xs text-yellow-400 mb-1">{t.pendingPayments}</p>
          <p className="text-2xl font-bold text-white">${pendingAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Sales List */}
      {sales.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-white/10">
          <p className="text-4xl mb-4">💰</p>
          <p className="text-white font-semibold">{t.noSales}</p>
          <p className="text-slate-400 text-sm mt-1">{t.addFirst}</p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">{t.type}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">{t.description}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">{t.amount}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">{t.date}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">{t.status}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="text-lg">{typeIcons[sale.type]}</span>
                      <span className="ml-2 text-sm text-slate-300">{t.types[sale.type]}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white max-w-[200px] truncate">
                      {sale.description}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      ${sale.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{sale.date}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-[10px] font-semibold rounded-full ${statusColors[sale.status]}`}
                      >
                        {t.statuses[sale.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(sale)}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          {t.edit}
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {editingSale ? t.edit : t.add}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.type}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as SalesRecord["type"] })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  >
                    <option value="ticket">{t.types.ticket}</option>
                    <option value="merchandise">{t.types.merchandise}</option>
                    <option value="sponsorship">{t.types.sponsorship}</option>
                    <option value="other">{t.types.other}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.status}</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as SalesRecord["status"] })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  >
                    <option value="completed">{t.statuses.completed}</option>
                    <option value="pending">{t.statuses.pending}</option>
                    <option value="refunded">{t.statuses.refunded}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.description}</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.amount} ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.date}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.customerName}</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.customerEmail}</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.notes}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm resize-none"
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
