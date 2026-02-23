"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";

interface RefereeProfile {
  id: string;
  firstName: string;
  lastName: string;
  headshot?: string;
  phone?: string;
  email?: string;
  bio?: string;
  experience?: string;
  certification?: string;
  yearsActive?: number;
  hometown?: string;
}

interface OtherReferee {
  id: string;
  name: string;
  headshot?: string;
}

const translations = {
  en: {
    backToHome: "Back to Home",
    leagueReferees: "League Referees",
    biography: "Biography",
    bioPlaceholder: "Biography coming soon...",
    contact: "Contact",
    phone: "Phone",
    email: "Email",
    certification: "Certification",
    yearsActive: "Years Active",
    hometown: "Hometown",
    experience: "Experience",
    otherRefs: "Other Referees",
    viewProfile: "View Profile",
    loading: "Loading...",
    notFound: "Referee not found",
  },
  fr: {
    backToHome: "Retour à l'accueil",
    leagueReferees: "Arbitres de la ligue",
    biography: "Biographie",
    bioPlaceholder: "Biographie à venir...",
    contact: "Contact",
    phone: "Téléphone",
    email: "Email",
    certification: "Certification",
    yearsActive: "Années d'expérience",
    hometown: "Ville d'origine",
    experience: "Expérience",
    otherRefs: "Autres arbitres",
    viewProfile: "Voir le profil",
    loading: "Chargement...",
    notFound: "Arbitre introuvable",
  },
};

export default function RefereeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = translations[language];

  const refId = params.refId as string;
  const [referee, setReferee] = useState<RefereeProfile | null>(null);
  const [otherRefs, setOtherRefs] = useState<OtherReferee[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const fetchReferee = async () => {
      if (!refId) return;
      setLoading(true);
      try {
        const refDoc = await getDoc(doc(firebaseDB, "referees", refId));
        if (refDoc.exists()) {
          const data = refDoc.data();
          setReferee({
            id: refDoc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            headshot: data.headshot,
            phone: data.phone,
            email: data.email,
            bio: data.bio || data.biography,
            experience: data.experience,
            certification: data.certification,
            yearsActive: data.yearsActive,
            hometown: data.hometown,
          });
        } else {
          setReferee(null);
        }

        const othersSnap = await getDocs(collection(firebaseDB, "referees"));
        const others = othersSnap.docs
          .filter((docSnap) => docSnap.id !== refId)
          .slice(0, 4)
          .map((docSnap) => {
            const info = docSnap.data();
            return {
              id: docSnap.id,
              name: `${info.firstName || ""} ${info.lastName || ""}`.trim() || "Referee",
              headshot: info.headshot,
            } as OtherReferee;
          });
        setOtherRefs(others);
      } catch (error) {
        console.error("Error loading referee profile:", error);
        setReferee(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReferee();
  }, [refId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#0a0f1a] to-[#020407] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 relative mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-orange-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!referee) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#0a0f1a] to-[#020407] text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-2xl font-semibold text-white mb-2">{t.notFound}</p>
          <p className="text-slate-400 mb-8">{language === "fr" ? "Cet arbitre n'existe pas ou a été retiré." : "This referee does not exist or has been removed."}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-full font-semibold hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t.backToHome}
          </button>
        </div>
      </div>
    );
  }

  const fullName = `${referee.firstName} ${referee.lastName}`.trim();
  const initials = `${referee.firstName.charAt(0)}${referee.lastName.charAt(0)}`.toUpperCase();
  const hasContact = referee.email || referee.phone;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#0a0f1a] to-[#020407] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] bg-[radial-gradient(circle,_rgba(249,115,22,0.15),_transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.1),_transparent_60%)] blur-3xl" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => router.push("/")}
              className="group flex items-center gap-2 sm:gap-3 text-slate-400 hover:text-white transition-colors"
            >
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 group-hover:border-white/20 group-hover:bg-white/10 transition-all">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <span className="hidden sm:inline font-medium">{t.backToHome}</span>
            </button>
            <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-widest truncate">{t.leagueReferees}</div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 mb-12 lg:mb-20">
          <div className="lg:col-span-2">
            <div className="sticky top-28">
              <div className={`relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 shadow-2xl shadow-black/50 transition-all duration-700 ${imageLoaded ? "scale-100" : "scale-95"}`}>
                {referee.headshot ? (
                  <>
                    <Image
                      src={referee.headshot}
                      alt={fullName}
                      fill
                      className={`object-cover transition-all duration-700 ${imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-110"}`}
                      onLoad={() => setImageLoaded(true)}
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-900/30 via-slate-900 to-slate-900">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-6xl font-bold text-white shadow-xl shadow-orange-500/30">
                        {initials}
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/90 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {language === "fr" ? "Arbitre" : "Referee"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">{fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 text-slate-400 text-sm">
                {referee.certification && (
                  <>
                    <span className="text-orange-400 font-medium">{referee.certification}</span>
                    <span className="text-slate-600">•</span>
                  </>
                )}
                {referee.yearsActive && (
                  <span>
                    {referee.yearsActive} {language === "fr" ? "ans d'expérience" : "yrs active"}
                  </span>
                )}
                {referee.hometown && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4s-3 1.567-3 3.5S10.343 11 12 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v8" />
                    </svg>
                    {referee.hometown}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.biography}
              </h2>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {referee.bio || t.bioPlaceholder}
                </p>
              </div>
            </div>

            {referee.experience && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.experience}
                </h2>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{referee.experience}</p>
                </div>
              </div>
            )}

            {hasContact && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.contact}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {referee.email && (
                    <a
                      href={`mailto:${referee.email}`}
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.email}</p>
                        <p className="text-white font-medium">{referee.email}</p>
                      </div>
                    </a>
                  )}
                  {referee.phone && (
                    <a
                      href={`tel:${referee.phone}`}
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.phone}</p>
                        <p className="text-white font-medium">{referee.phone}</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {otherRefs.length > 0 && (
          <section className="border-t border-white/5 pt-8 sm:pt-12 lg:pt-16">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">{t.otherRefs}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {otherRefs.map((other) => (
                <Link
                  key={other.id}
                  href={`/referees/${other.id}`}
                  className="group relative overflow-hidden rounded-lg sm:rounded-2xl border border-white/5 bg-white/[0.02] hover:border-orange-500/30 hover:bg-orange-500/5 transition-all"
                >
                  <div className="aspect-square sm:aspect-[4/5] relative">
                    {other.headshot ? (
                      <Image
                        src={other.headshot}
                        alt={other.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/50 to-slate-900">
                        <div className="flex h-10 w-10 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-base sm:text-3xl font-bold text-white">
                          {other.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-4">
                      <p className="text-[10px] sm:text-base font-semibold text-white truncate">{other.name}</p>
                      <p className="text-[8px] sm:text-sm text-orange-400 truncate">{language === "fr" ? "Arbitre" : "Referee"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-black/30 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t.backToHome}
          </Link>
        </div>
      </footer>
    </div>
  );
}
