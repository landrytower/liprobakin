"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAdmin } from "../layout";
import { firebaseAuth, firebaseDB } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type DocumentFolder = {
  id: string;
  name: string;
  description: string;
  createdById?: string;
  createdByName?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type LeagueDocument = {
  id: string;
  folderId: string;
  folderName?: string;
  title: string;
  description: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  previewType: "image" | "pdf" | "other";
  createdById?: string;
  createdByName?: string;
  source?: "upload" | "chat";
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type AdminMessage = {
  id: string;
  message: string;
  createdById?: string;
  createdByName?: string;
  createdByPhoto?: string;
  folderId?: string;
  folderName?: string;
  documentId?: string;
  documentTitle?: string;
  documentUrl?: string;
  documentType?: string;
  createdAt?: Date | null;
};

type FolderFormState = {
  name: string;
  description: string;
};

type UploadFormState = {
  folderId: string;
  title: string;
  description: string;
  createFolderName: string;
  createFolderDescription: string;
};

type ChatFormState = {
  message: string;
  folderId: string;
  createFolderName: string;
  createFolderDescription: string;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

const normalizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");

const getPreviewType = (file: File): LeagueDocument["previewType"] => {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type === "application/pdf") {
    return "pdf";
  }
  return "other";
};

const isImagePreview = (documentItem: LeagueDocument) => documentItem.previewType === "image";

const translations = {
  en: {
    title: "Documents",
    subtitle: "Shared folders, league files, and admin chat in one place.",
    back: "Back to dashboard",
    createFolder: "Create folder",
    folders: "Folders",
    allDocuments: "All folders",
    folderName: "Folder name",
    folderDescription: "Folder description",
    create: "Create",
    creating: "Creating...",
    uploadTitle: "Share a document",
    uploadSubtitle: "Upload PDFs or images and file them inside the right folder.",
    docTitle: "Document title",
    docDescription: "Document description",
    chooseFolder: "Choose folder",
    createNewFolderInline: "Create new folder instead",
    file: "File",
    upload: "Upload document",
    uploading: "Uploading...",
    folderRequired: "Pick a folder or create a new one before sharing a file.",
    noFolders: "No folders yet",
    noFoldersHint: "Create the first folder to start organizing league documents.",
    noDocuments: "No documents in this folder yet.",
    noDocumentsHint: "Upload a PDF or image and add context for the admin team.",
    open: "Open",
    pdf: "PDF",
    image: "Image",
    fileType: "File",
    chatTitle: "Admin chat",
    chatSubtitle: "Use this to coordinate and optionally attach a file directly into a folder.",
    chatPlaceholder: "Write an update, rule change, or note for the admin team...",
    attachFile: "Attach file in chat",
    sendMessage: "Send",
    sending: "Sending...",
    chatEmpty: "No admin messages yet.",
    postedIn: "posted in",
    sharedDocument: "shared a document",
    by: "By",
    activeFolder: "Active folder",
    documentsCount: "documents",
    clearInlineFolder: "Use existing folder",
  },
  fr: {
    title: "Documents",
    subtitle: "Dossiers partagés, fichiers de la ligue et chat admin au même endroit.",
    back: "Retour au tableau de bord",
    createFolder: "Créer un dossier",
    folders: "Dossiers",
    allDocuments: "Tous les dossiers",
    folderName: "Nom du dossier",
    folderDescription: "Description du dossier",
    create: "Créer",
    creating: "Création...",
    uploadTitle: "Partager un document",
    uploadSubtitle: "Téléversez des PDF ou images et rangez-les dans le bon dossier.",
    docTitle: "Titre du document",
    docDescription: "Description du document",
    chooseFolder: "Choisir un dossier",
    createNewFolderInline: "Créer un nouveau dossier à la place",
    file: "Fichier",
    upload: "Téléverser le document",
    uploading: "Téléversement...",
    folderRequired: "Choisissez un dossier ou créez-en un nouveau avant de partager le fichier.",
    noFolders: "Aucun dossier pour le moment",
    noFoldersHint: "Créez le premier dossier pour organiser les documents de la ligue.",
    noDocuments: "Aucun document dans ce dossier.",
    noDocumentsHint: "Téléversez un PDF ou une image avec du contexte pour l'équipe admin.",
    open: "Ouvrir",
    pdf: "PDF",
    image: "Image",
    fileType: "Fichier",
    chatTitle: "Chat admin",
    chatSubtitle: "Coordonnez-vous ici et joignez un fichier directement dans un dossier si besoin.",
    chatPlaceholder: "Écrivez une mise à jour, une règle, ou une note pour l'équipe admin...",
    attachFile: "Joindre un fichier dans le chat",
    sendMessage: "Envoyer",
    sending: "Envoi...",
    chatEmpty: "Aucun message admin pour le moment.",
    postedIn: "publié dans",
    sharedDocument: "a partagé un document",
    by: "Par",
    activeFolder: "Dossier actif",
    documentsCount: "documents",
    clearInlineFolder: "Utiliser un dossier existant",
  },
} as const;

export default function AdminDocumentsPage() {
  const { language, currentAdminUser } = useAdmin();
  const t = translations[language];

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<LeagueDocument[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [folderForm, setFolderForm] = useState<FolderFormState>({ name: "", description: "" });
  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    folderId: "",
    title: "",
    description: "",
    createFolderName: "",
    createFolderDescription: "",
  });
  const [chatForm, setChatForm] = useState<ChatFormState>({
    message: "",
    folderId: "",
    createFolderName: "",
    createFolderDescription: "",
  });
  const [folderSaving, setFolderSaving] = useState(false);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [messageSaving, setMessageSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeFolders = onSnapshot(collection(firebaseDB, "adminDocumentFolders"), (snapshot) => {
      const nextFolders = snapshot.docs
        .map((folderDoc) => {
          const data = folderDoc.data();
          return {
            id: folderDoc.id,
            name: String(data.name || "Untitled folder"),
            description: String(data.description || ""),
            createdById: data.createdById,
            createdByName: data.createdByName,
            createdAt: data.createdAt?.toDate?.() ?? null,
            updatedAt: data.updatedAt?.toDate?.() ?? null,
          } as DocumentFolder;
        })
        .sort((a, b) => {
          const aTime = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
          const bTime = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
          return bTime - aTime;
        });

      setFolders(nextFolders);
    });

    const unsubscribeDocuments = onSnapshot(collection(firebaseDB, "adminDocuments"), (snapshot) => {
      const nextDocuments = snapshot.docs
        .map((documentDoc) => {
          const data = documentDoc.data();
          return {
            id: documentDoc.id,
            folderId: String(data.folderId || ""),
            folderName: data.folderName,
            title: String(data.title || "Untitled document"),
            description: String(data.description || ""),
            fileName: String(data.fileName || ""),
            fileType: String(data.fileType || ""),
            fileSize: Number(data.fileSize || 0),
            url: String(data.url || ""),
            previewType: data.previewType === "image" || data.previewType === "pdf" ? data.previewType : "other",
            createdById: data.createdById,
            createdByName: data.createdByName,
            source: data.source === "chat" ? "chat" : "upload",
            createdAt: data.createdAt?.toDate?.() ?? null,
            updatedAt: data.updatedAt?.toDate?.() ?? null,
          } as LeagueDocument;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.getTime() || 0;
          const bTime = b.createdAt?.getTime() || 0;
          return bTime - aTime;
        });

      setDocuments(nextDocuments);
    });

    const unsubscribeMessages = onSnapshot(collection(firebaseDB, "adminDocumentMessages"), (snapshot) => {
      const nextMessages = snapshot.docs
        .map((messageDoc) => {
          const data = messageDoc.data();
          return {
            id: messageDoc.id,
            message: String(data.message || ""),
            createdById: data.createdById,
            createdByName: data.createdByName,
            createdByPhoto: data.createdByPhoto,
            folderId: data.folderId,
            folderName: data.folderName,
            documentId: data.documentId,
            documentTitle: data.documentTitle,
            documentUrl: data.documentUrl,
            documentType: data.documentType,
            createdAt: data.createdAt?.toDate?.() ?? null,
          } as AdminMessage;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.getTime() || 0;
          const bTime = b.createdAt?.getTime() || 0;
          return aTime - bTime;
        });

      setMessages(nextMessages);
    });

    return () => {
      unsubscribeFolders();
      unsubscribeDocuments();
      unsubscribeMessages();
    };
  }, []);

  useEffect(() => {
    if (activeFolderId === "all") {
      return;
    }

    if (folders.some((folder) => folder.id === activeFolderId)) {
      return;
    }

    setActiveFolderId("all");
  }, [activeFolderId, folders]);

  const documentCountByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((documentItem) => {
      counts.set(documentItem.folderId, (counts.get(documentItem.folderId) ?? 0) + 1);
    });
    return counts;
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (activeFolderId === "all") {
      return documents;
    }
    return documents.filter((documentItem) => documentItem.folderId === activeFolderId);
  }, [activeFolderId, documents]);

  const hasInlineChatFolder = Boolean(chatForm.createFolderName.trim() || chatForm.createFolderDescription.trim());

  const activeFolder = useMemo(() => {
    if (activeFolderId === "all") {
      return null;
    }
    return folders.find((folder) => folder.id === activeFolderId) ?? null;
  }, [activeFolderId, folders]);

  const chatMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      isOwnMessage: Boolean(currentAdminUser?.id) && message.createdById === currentAdminUser?.id,
    }));
  }, [currentAdminUser?.id, messages]);

  const createFolderRecord = async (name: string, description: string) => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      throw new Error(language === "fr" ? "Le nom et la description du dossier sont requis." : "Folder name and description are required.");
    }

    const existingFolder = folders.find((folder) => folder.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existingFolder) {
      return existingFolder;
    }

    const folderRef = await addDoc(collection(firebaseDB, "adminDocumentFolders"), {
      name: trimmedName,
      description: trimmedDescription,
      createdById: currentAdminUser?.id || "unknown",
      createdByName: currentAdminUser?.displayName || currentAdminUser?.email || "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: folderRef.id,
      name: trimmedName,
      description: trimmedDescription,
      createdById: currentAdminUser?.id,
      createdByName: currentAdminUser?.displayName || currentAdminUser?.email,
      createdAt: null,
      updatedAt: null,
    } as DocumentFolder;
  };

  const ensureFolderSelection = async (selectedFolderId: string, createName: string, createDescription: string) => {
    if (createName.trim() || createDescription.trim()) {
      return createFolderRecord(createName, createDescription);
    }

    const existingFolder = folders.find((folder) => folder.id === selectedFolderId);
    if (!existingFolder) {
      throw new Error(t.folderRequired);
    }

    return existingFolder;
  };

  const uploadFileToStorage = async (file: File, folder: DocumentFolder) => {
    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      throw new Error(language === "fr" ? "Votre session a expiré. Reconnectez-vous." : "Your session has expired. Please sign in again.");
    }

    const idToken = await currentUser.getIdToken();
    const formData = new FormData();
    formData.append("folderId", folder.id);
    formData.append("file", file, normalizeFileName(file.name));

    const response = await fetch("/api/admin/documents/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

    if (!response.ok || !payload?.url) {
      throw new Error(
        payload?.error ||
          (language === "fr" ? "Impossible de téléverser le fichier." : "Failed to upload file.")
      );
    }

    return payload.url;
  };

  const createDocumentRecord = async ({
    file,
    folder,
    title,
    description,
    source,
  }: {
    file: File;
    folder: DocumentFolder;
    title: string;
    description: string;
    source: "upload" | "chat";
  }) => {
    const downloadUrl = await uploadFileToStorage(file, folder);
    const previewType = getPreviewType(file);
    const documentRef = await addDoc(collection(firebaseDB, "adminDocuments"), {
      folderId: folder.id,
      folderName: folder.name,
      title: title.trim(),
      description: description.trim(),
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      url: downloadUrl,
      previewType,
      source,
      createdById: currentAdminUser?.id || "unknown",
      createdByName: currentAdminUser?.displayName || currentAdminUser?.email || "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(firebaseDB, "adminDocumentFolders", folder.id), {
      updatedAt: serverTimestamp(),
    });

    return {
      id: documentRef.id,
      title: title.trim(),
      url: downloadUrl,
      previewType,
      folder,
    };
  };

  const handleCreateFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    setFolderSaving(true);
    setFolderError(null);

    try {
      const createdFolder = await createFolderRecord(folderForm.name, folderForm.description);
      setActiveFolderId(createdFolder.id);
      setFolderForm({ name: "", description: "" });
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : (language === "fr" ? "Impossible de créer le dossier." : "Failed to create folder."));
    } finally {
      setFolderSaving(false);
    }
  };

  const handleUploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    setUploadSaving(true);
    setUploadError(null);

    try {
      if (!uploadFile) {
        throw new Error(language === "fr" ? "Veuillez choisir un fichier." : "Please choose a file.");
      }

      if (!uploadForm.title.trim() || !uploadForm.description.trim()) {
        throw new Error(language === "fr" ? "Le titre et la description du document sont requis." : "Document title and description are required.");
      }

      const folder = await ensureFolderSelection(
        uploadForm.folderId || activeFolderId,
        uploadForm.createFolderName,
        uploadForm.createFolderDescription
      );

      await createDocumentRecord({
        file: uploadFile,
        folder,
        title: uploadForm.title,
        description: uploadForm.description,
        source: "upload",
      });

      setActiveFolderId(folder.id);
      setUploadFile(null);
      setUploadForm({
        folderId: folder.id,
        title: "",
        description: "",
        createFolderName: "",
        createFolderDescription: "",
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : (language === "fr" ? "Impossible de téléverser le document." : "Failed to upload document."));
    } finally {
      setUploadSaving(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessageSaving(true);
    setChatError(null);

    try {
      const trimmedMessage = chatForm.message.trim();
      if (!trimmedMessage && !chatFile) {
        throw new Error(language === "fr" ? "Ajoutez un message ou joignez un fichier." : "Add a message or attach a file.");
      }

      let sharedDocument:
        | {
            id: string;
            title: string;
            url: string;
            previewType: LeagueDocument["previewType"];
            folder: DocumentFolder;
          }
        | undefined;

      if (chatFile) {
        const chatFolder = await ensureFolderSelection(
          chatForm.folderId || activeFolderId,
          chatForm.createFolderName,
          chatForm.createFolderDescription
        );

        sharedDocument = await createDocumentRecord({
          file: chatFile,
          folder: chatFolder,
          title: chatFile.name,
          description: trimmedMessage || (language === "fr" ? "Document partagé via le chat admin." : "Document shared from the admin chat."),
          source: "chat",
        });

        setActiveFolderId(chatFolder.id);
      }

      await addDoc(collection(firebaseDB, "adminDocumentMessages"), {
        message: trimmedMessage,
        createdById: currentAdminUser?.id || "unknown",
        createdByName: currentAdminUser?.displayName || currentAdminUser?.email || "Admin",
        createdByPhoto: currentAdminUser?.photo || "",
        folderId: sharedDocument?.folder.id || null,
        folderName: sharedDocument?.folder.name || null,
        documentId: sharedDocument?.id || null,
        documentTitle: sharedDocument?.title || null,
        documentUrl: sharedDocument?.url || null,
        documentType: sharedDocument?.previewType || null,
        createdAt: serverTimestamp(),
      });

      setChatFile(null);
      setChatForm({
        message: "",
        folderId: sharedDocument?.folder.id || "",
        createFolderName: "",
        createFolderDescription: "",
      });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : (language === "fr" ? "Impossible d'envoyer le message." : "Failed to send message."));
    } finally {
      setMessageSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pulse"
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t.back}
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-xs sm:text-sm text-slate-400">{t.subtitle}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-500">{t.activeFolder}:</span>{" "}
          <span className="font-semibold text-white">{activeFolder?.name || t.allDocuments}</span>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t.folders}</h2>
          <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{folders.length} {language === "fr" ? "dossiers" : "folders"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => setActiveFolderId("all")}
            className={`rounded-3xl border px-4 py-5 text-left transition ${
              activeFolderId === "all"
                ? "border-orange-400/60 bg-orange-500/10 text-white"
                : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/20"
            }`}
          >
            <p className="text-xs uppercase tracking-wider sm:tracking-[0.25em] text-slate-400">{t.allDocuments}</p>
            <p className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-white">{documents.length}</p>
            <p className="mt-1 text-xs text-slate-500">{t.documentsCount}</p>
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                setActiveFolderId(folder.id);
                setUploadForm((current) => ({ ...current, folderId: folder.id }));
                setChatForm((current) => ({ ...current, folderId: folder.id }));
              }}
              className={`rounded-3xl border px-4 py-5 text-left transition ${
                activeFolderId === folder.id
                  ? "border-orange-400/60 bg-orange-500/10 text-white"
                  : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-semibold text-white">{folder.name}</p>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                  {documentCountByFolder.get(folder.id) ?? 0}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-xs text-slate-500">{folder.description}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateFolder} className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold text-white">{t.createFolder}</h3>
              <p className="text-sm text-slate-400">{language === "fr" ? "Créez un dossier pour classer les règlements, images, affiches ou circulaires." : "Create a folder for rules, images, posters, or circulars."}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1.8fr_auto]">
            <input
              type="text"
              value={folderForm.name}
              onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t.folderName}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
            />
            <input
              type="text"
              value={folderForm.description}
              onChange={(event) => setFolderForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t.folderDescription}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
            />
            <button
              type="submit"
              disabled={folderSaving}
              className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {folderSaving ? t.creating : t.create}
            </button>
          </div>
          {folderError ? <p className="mt-3 text-sm text-rose-400">{folderError}</p> : null}
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-6">
          <form onSubmit={handleUploadDocument} className="rounded-[2rem] border border-white/10 bg-slate-900/50 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-white">{t.uploadTitle}</h2>
                <p className="text-sm text-slate-400">{t.uploadSubtitle}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={uploadForm.title}
                onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={t.docTitle}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
              />
              <input
                type="text"
                value={uploadForm.description}
                onChange={(event) => setUploadForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t.docDescription}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
              />
              <select
                aria-label={t.chooseFolder}
                title={t.chooseFolder}
                value={uploadForm.folderId}
                onChange={(event) => setUploadForm((current) => ({ ...current, folderId: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
              >
                <option value="">{t.chooseFolder}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 transition hover:border-orange-400/60">
                <span className="truncate">{uploadFile ? uploadFile.name : t.file}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
                <span className="ml-3 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{t.file}</span>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium text-white">{t.createNewFolderInline}</p>
                {(uploadForm.createFolderName || uploadForm.createFolderDescription) ? (
                  <button
                    type="button"
                    onClick={() => setUploadForm((current) => ({ ...current, createFolderName: "", createFolderDescription: "" }))}
                    className="text-xs text-slate-400 transition hover:text-white"
                  >
                    {t.clearInlineFolder}
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={uploadForm.createFolderName}
                  onChange={(event) => setUploadForm((current) => ({ ...current, createFolderName: event.target.value }))}
                  placeholder={t.folderName}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
                />
                <input
                  type="text"
                  value={uploadForm.createFolderDescription}
                  onChange={(event) => setUploadForm((current) => ({ ...current, createFolderDescription: event.target.value }))}
                  placeholder={t.folderDescription}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              {uploadError ? <p className="text-sm text-rose-400">{uploadError}</p> : <span />}
              <button
                type="submit"
                disabled={uploadSaving}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadSaving ? t.uploading : t.upload}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-slate-900/50 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-white">{activeFolder?.name || t.allDocuments}</h2>
                <p className="text-sm text-slate-400">{activeFolder?.description || t.noDocumentsHint}</p>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                {filteredDocuments.length} {t.documentsCount}
              </div>
            </div>

            {folders.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-white">{t.noFolders}</p>
                <p className="mt-2 text-sm text-slate-400">{t.noFoldersHint}</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-white">{t.noDocuments}</p>
                <p className="mt-2 text-sm text-slate-400">{t.noDocumentsHint}</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredDocuments.map((documentItem) => (
                  <article key={documentItem.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
                    <div className="relative flex min-h-44 items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
                      {isImagePreview(documentItem) ? (
                        <Image
                          src={documentItem.url}
                          alt={documentItem.title}
                          fill
                          className="object-cover"
                        />
                      ) : documentItem.previewType === "pdf" ? (
                        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-4xl">📄</div>
                          <p className="text-sm font-semibold text-white">{t.pdf}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
                          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-4xl">🗂️</div>
                          <p className="text-sm font-semibold text-white">{t.fileType}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-semibold text-white line-clamp-2">{documentItem.title}</p>
                          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                            {documentItem.previewType === "pdf" ? t.pdf : documentItem.previewType === "image" ? t.image : t.fileType}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400 line-clamp-3">{documentItem.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{documentItem.folderName || folders.find((folder) => folder.id === documentItem.folderId)?.name || "-"}</span>
                        <span>•</span>
                        <span>{formatBytes(documentItem.fileSize)}</span>
                        <span>•</span>
                        <span>{documentItem.createdAt ? documentItem.createdAt.toLocaleString(language === "fr" ? "fr-FR" : "en-US") : "-"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">{t.by} {documentItem.createdByName || "Admin"}</p>
                        <a
                          href={documentItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500/20 hover:text-orange-200"
                        >
                          {t.open}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="flex min-h-[400px] sm:min-h-[740px] flex-col overflow-hidden rounded-2xl sm:rounded-[2rem] border border-white/10 bg-slate-900/50 p-4 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">{t.chatTitle}</h2>
            <p className="text-sm text-slate-400">{t.chatSubtitle}</p>
          </div>

          <div className="mt-5 flex-1 overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/60 px-3 py-4 sm:px-4">
            {chatMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-slate-500">{t.chatEmpty}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex ${message.isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex max-w-[82%] flex-col gap-1 ${message.isOwnMessage ? "items-end" : "items-start"}`}>
                      <div className={`flex items-end gap-2 ${message.isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                        {!message.isOwnMessage ? (
                          message.createdByPhoto ? (
                            <Image
                              src={message.createdByPhoto}
                              alt={message.createdByName || "Admin"}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs font-bold text-white">
                              {(message.createdByName || "A").slice(0, 1).toUpperCase()}
                            </div>
                          )
                        ) : null}

                        <div
                          className={`rounded-[1.6rem] border px-4 py-3 shadow-sm ${
                            message.isOwnMessage
                              ? "border-orange-400/30 bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-white"
                              : "border-white/10 bg-white/5 text-slate-100"
                          }`}
                        >
                          {!message.isOwnMessage ? (
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                              {message.createdByName || "Admin"}
                            </p>
                          ) : null}

                          {message.message ? (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-current">{message.message}</p>
                          ) : null}

                          {message.documentUrl ? (
                            <div
                              className={`mt-3 rounded-[1.2rem] border p-3 ${
                                message.isOwnMessage
                                  ? "border-orange-300/25 bg-black/15"
                                  : "border-cyan-400/20 bg-cyan-500/10"
                              }`}
                            >
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{t.sharedDocument}</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">{message.documentTitle}</p>
                                  <p className="text-xs text-slate-300">{t.postedIn} {message.folderName || "-"}</p>
                                </div>
                                <a
                                  href={message.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                                >
                                  {t.open}
                                </a>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <p className={`px-2 text-[11px] text-slate-500 ${message.isOwnMessage ? "text-right" : "text-left"}`}>
                        {message.createdAt ? message.createdAt.toLocaleString(language === "fr" ? "fr-FR" : "en-US") : ""}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/70 p-3 sm:p-4">
            {chatFile || hasInlineChatFolder || chatError ? (
              <div className="mb-3 space-y-3 rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-3">
                {chatFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                    <span className="truncate">{chatFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setChatFile(null)}
                      className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    aria-label={t.chooseFolder}
                    title={t.chooseFolder}
                    value={chatForm.folderId}
                    onChange={(event) => setChatForm((current) => ({ ...current, folderId: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
                  >
                    <option value="">{t.chooseFolder}</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>

                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-slate-900/40 px-4 py-3 text-sm text-slate-300 transition hover:border-orange-400/60">
                    <span className="truncate">{chatFile ? chatFile.name : t.attachFile}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(event) => setChatFile(event.target.files?.[0] ?? null)}
                    />
                    <span className="ml-3 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">+</span>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={chatForm.createFolderName}
                    onChange={(event) => setChatForm((current) => ({ ...current, createFolderName: event.target.value }))}
                    placeholder={t.folderName}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
                  />
                  <input
                    type="text"
                    value={chatForm.createFolderDescription}
                    onChange={(event) => setChatForm((current) => ({ ...current, createFolderDescription: event.target.value }))}
                    placeholder={t.folderDescription}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/60"
                  />
                </div>

                {chatError ? <p className="text-sm text-rose-400">{chatError}</p> : null}
              </div>
            ) : null}

            <div className="flex items-end gap-3 rounded-[1.7rem] border border-white/10 bg-white/5 px-3 py-2">
              <textarea
                value={chatForm.message}
                onChange={(event) => setChatForm((current) => ({ ...current, message: event.target.value }))}
                placeholder={language === "fr" ? "Tapez votre message..." : "Tap to text..."}
                rows={1}
                className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />

              <div className="flex items-center gap-2">
                <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-lg text-slate-300 transition hover:border-orange-400/60 hover:text-white">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(event) => setChatFile(event.target.files?.[0] ?? null)}
                  />
                  +
                </label>
                <button
                  type="submit"
                  disabled={messageSaving}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {messageSaving ? t.sending : t.sendMessage}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}