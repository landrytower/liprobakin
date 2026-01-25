"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Article = { id: string; title: string; headline: string; summary: string; category?: string; author?: string; imageUrl?: string; createdAt?: { seconds: number }; };

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "News & Stories",
    subtitle: "Create and manage articles",
    createStory: "Create Story",
    editStory: "Edit Story",
    publishedStories: "Published Stories",
    noStories: "No stories published yet",
    articleTitle: "Title",
    headline: "Headline",
    summary: "Content",
    category: "Category",
    author: "Author",
    coverPhoto: "Cover Photo",
    publish: "Publish",
    update: "Update",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    clear: "Clear",
    noImage: "No image",
  },
  fr: {
    title: "Actualités & Histoires",
    subtitle: "Créer et gérer les articles",
    createStory: "Créer un Article",
    editStory: "Modifier l'Article",
    publishedStories: "Articles Publiés",
    noStories: "Aucun article publié",
    articleTitle: "Titre",
    headline: "Accroche",
    summary: "Contenu",
    category: "Catégorie",
    author: "Auteur",
    coverPhoto: "Photo de Couverture",
    publish: "Publier",
    update: "Mettre à jour",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    clear: "Effacer",
    noImage: "Pas d'image",
  },
};

export default function StoriesPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState({ title: "", headline: "", summary: "", category: "", author: "", imageUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firebaseDB, "news"), orderBy("createdAt", "desc")));
      setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Article)));
    } catch (error) { console.error("Error fetching articles:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const openModal = (article?: Article) => {
    setEditing(article || null);
    setForm(article ? { title: article.title, headline: article.headline, summary: article.summary, category: article.category || "", author: article.author || "", imageUrl: article.imageUrl || "" } : { title: "", headline: "", summary: "", category: "", author: "", imageUrl: "" });
    setImagePreview(article?.imageUrl || ""); setImageFile(null); setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
  };

  const saveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.headline || !form.summary) return;
    setSaving(true);
    try {
      let imgUrl = form.imageUrl;
      if (imageFile) {
        const path = `news/${Date.now()}.png`;
        const storageReference = storageRef(firebaseStorage, path);
        await uploadBytes(storageReference, imageFile);
        imgUrl = await getDownloadURL(storageReference);
      }
      const data = { title: form.title.trim(), headline: form.headline.trim(), summary: form.summary, category: form.category || null, author: form.author || null, imageUrl: imgUrl || null, updatedAt: serverTimestamp() };
      if (editing) { await updateDoc(doc(firebaseDB, "news", editing.id), data); }
      else { await addDoc(collection(firebaseDB, "news"), { ...data, createdAt: serverTimestamp() }); }
      setShowModal(false); fetchArticles();
    } catch (error) { console.error("Error saving article:", error); }
    finally { setSaving(false); }
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try { await deleteDoc(doc(firebaseDB, "news", id)); fetchArticles(); } catch (error) { console.error(error); }
  };

  const formatDate = (ts?: { seconds: number }) => ts ? new Date(ts.seconds * 1000).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const canManageNews = currentAdminUser?.permissions?.canManageNews;

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>
        {canManageNews && (<button onClick={() => openModal()} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition">+ {copy.createStory}</button>)}
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
          <div className="text-5xl mb-4">📰</div>
          <p className="text-base font-semibold text-slate-300">{copy.noStories}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div key={article.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-800/30 p-4 hover:bg-slate-800/50 transition">
              {article.imageUrl ? (
                <div className="relative h-20 w-28 flex-shrink-0 rounded-lg overflow-hidden"><Image src={article.imageUrl} alt={article.title} fill className="object-cover" unoptimized /></div>
              ) : (<div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/10 bg-slate-900/50"><span className="text-xs text-slate-600">{copy.noImage}</span></div>)}
              <div className="flex-1 min-w-0">
                {article.category && (<span className="text-[10px] text-orange-400 uppercase font-semibold">{article.category}</span>)}
                <h3 className="text-sm font-semibold text-white truncate">{article.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-1">{article.headline}</p>
                <p className="text-[10px] text-slate-500 mt-1">{formatDate(article.createdAt)}</p>
              </div>
              {canManageNews && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openModal(article)} className="px-3 py-1.5 rounded-lg border border-white/20 text-xs text-slate-300 hover:bg-white/5">{copy.edit}</button>
                  <button onClick={() => deleteArticle(article.id)} className="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-300 hover:bg-red-500/10">{copy.delete}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl my-8">
            <div className="p-6 border-b border-white/10"><h3 className="text-xl font-bold text-white">{editing ? copy.editStory : copy.createStory}</h3></div>
            <form onSubmit={saveArticle} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.articleTitle} *</label><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={copy.articleTitle} required className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.category}</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={copy.category} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.headline} *</label><input type="text" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder={copy.headline} required className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.summary} *</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder={copy.summary} rows={6} required className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white resize-none" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.author}</label><input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder={copy.author} className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">{copy.coverPhoto}</label><div className="flex items-center gap-4">{imagePreview && (<div className="relative w-24 h-16 rounded-lg overflow-hidden"><Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized /></div>)}<input type="file" accept="image/*" onChange={handleImageChange} title={copy.coverPhoto} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500 file:text-white" /></div></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50">{saving ? "..." : editing ? copy.update : copy.publish}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
