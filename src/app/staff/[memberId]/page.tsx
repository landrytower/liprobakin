"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string;
  phone?: string;
  photo?: string;
  bio?: string;
  department?: string;
  position?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  yearsOfService?: number;
  joinedDate?: string;
  achievements?: string[];
  education?: string;
  experience?: string;
}

interface OtherMember {
  id: string;
  name: string;
  role: string;
  photo?: string;
}

const translations = {
  en: {
    backToHome: "Back to Home",
    contact: "Contact Information",
    email: "Email",
    phone: "Phone",
    department: "Department",
    position: "Position", 
    biography: "Biography",
    notFound: "Staff member not found",
    loading: "Loading...",
    leagueStaff: "League Committee",
    leagueCommission: "League Commission",
    connectWith: "Connect with",
    yearsOfService: "Years of Service",
    joinedDate: "Joined",
    achievements: "Achievements",
    education: "Education",
    experience: "Experience",
    otherMembers: "Other Committee Members",
    otherCommissionMembers: "Other Commission Members",
    viewProfile: "View Profile",
    noBio: "Biography coming soon...",
  },
  fr: {
    backToHome: "Retour à l'accueil",
    contact: "Coordonnées",
    email: "Email", 
    phone: "Téléphone",
    department: "Département",
    position: "Poste",
    biography: "Biographie",
    notFound: "Membre du personnel introuvable",
    loading: "Chargement...",
    leagueStaff: "Comité de la ligue",
    leagueCommission: "Commission de la ligue",
    connectWith: "Connecter avec",
    yearsOfService: "Années de service",
    joinedDate: "Rejoint",
    achievements: "Réalisations",
    education: "Éducation",
    experience: "Expérience",
    otherMembers: "Autres membres du comité",
    otherCommissionMembers: "Autres membres de la commission",
    viewProfile: "Voir le profil",
    noBio: "Biographie à venir...",
  }
};

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = translations[language];
  
  const memberId = params.memberId as string;
  const [member, setMember] = useState<StaffMember | null>(null);
  const [otherMembers, setOtherMembers] = useState<OtherMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [memberType, setMemberType] = useState<"committee" | "commission" | "staff">("committee");

  useEffect(() => {
    const fetchMember = async () => {
      try {
        setLoading(true);
        
        // Try different possible collection names
        const collections = ["committee", "commission", "committeeMembers", "staff"];
        
        for (const collectionName of collections) {
          try {
            const docRef = doc(firebaseDB, collectionName, memberId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const data = docSnap.data();
              setMemberType(collectionName === "commission" ? "commission" : "committee");
              setMember({
                id: docSnap.id,
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                role: data.role || "",
                email: data.email,
                phone: data.phone,
                photo: data.photo,
                bio: data.bio,
                department: data.department,
                position: data.position,
                twitter: data.twitter,
                linkedin: data.linkedin,
                facebook: data.facebook,
                instagram: data.instagram,
                yearsOfService: data.yearsOfService,
                joinedDate: data.joinedDate,
                achievements: data.achievements,
                education: data.education,
                experience: data.experience,
              });

              // Fetch other members from the same collection
              const allMembersSnap = await getDocs(collection(firebaseDB, collectionName));
              const others = allMembersSnap.docs
                .filter(d => d.id !== memberId)
                .slice(0, 4)
                .map(d => {
                  const memberData = d.data();
                  return {
                    id: d.id,
                    name: `${memberData.firstName || ""} ${memberData.lastName || ""}`.trim(),
                    role: memberData.role || "",
                    photo: memberData.photo,
                  };
                });
              setOtherMembers(others);
              break;
            }
          } catch (error) {
            console.log(`Collection ${collectionName} not found or error:`, error);
          }
        }
      } catch (error) {
        console.error("Error fetching staff member:", error);
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      fetchMember();
    }
  }, [memberId]);

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

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#0a0f1a] to-[#020407] text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-2xl font-semibold text-white mb-2">{t.notFound}</p>
          <p className="text-slate-400 mb-8">The member you&apos;re looking for doesn&apos;t exist or has been removed.</p>
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

  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
  const hasSocials = member.twitter || member.linkedin || member.facebook || member.instagram;
  const hasContact = member.email || member.phone;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#0a0f1a] to-[#020407] text-white">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] bg-[radial-gradient(circle,_rgba(249,115,22,0.15),_transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.1),_transparent_60%)] blur-3xl" />
      </div>

      {/* Navigation */}
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
            <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-widest truncate">
              {memberType === "commission" ? t.leagueCommission : t.leagueStaff}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 mb-12 lg:mb-20">
          {/* Photo Column */}
          <div className="lg:col-span-2">
            <div className="sticky top-28">
              <div className={`relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 shadow-2xl shadow-black/50 transition-all duration-700 ${imageLoaded ? 'scale-100' : 'scale-95'}`}>
                {member.photo ? (
                  <>
                    <Image
                      src={member.photo}
                      alt={fullName}
                      fill
                      className={`object-cover transition-all duration-700 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
                      onLoad={() => setImageLoaded(true)}
                      priority
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </>
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br via-slate-900 to-slate-900 ${
                    memberType === "commission" ? "from-blue-900/30" : "from-orange-900/30"
                  }`}>
                    <div className="text-center">
                      <div className={`mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br text-6xl font-bold text-white shadow-xl ${
                        memberType === "commission" 
                          ? "from-blue-500 to-blue-600 shadow-blue-500/30" 
                          : "from-orange-500 to-orange-600 shadow-orange-500/30"
                      }`}>
                        {initials}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Role badge on photo */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className={`inline-flex items-center gap-2 rounded-full backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white shadow-lg ${
                    memberType === "commission" ? "bg-blue-500/90" : "bg-orange-500/90"
                  }`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {member.role}
                  </div>
                </div>
              </div>

              {/* Social Links */}
              {hasSocials && (
                <div className="mt-6">
                  <p className="text-sm text-slate-500 mb-3 uppercase tracking-widest">{t.connectWith} {member.firstName}</p>
                  <div className="flex gap-3">
                    {member.twitter && (
                      <a href={member.twitter} target="_blank" rel="noopener noreferrer" title="Twitter" aria-label="Twitter" className="social-icon-gold flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                      </a>
                    )}
                    {member.linkedin && (
                      <a href={member.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className="social-icon-gold flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {member.facebook && (
                      <a href={member.facebook} target="_blank" rel="noopener noreferrer" title="Facebook" aria-label="Facebook" className="social-icon-gold flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                    {member.instagram && (
                      <a href={member.instagram} target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" className="social-icon-gold flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Column */}
          <div className="lg:col-span-3 space-y-8">
            {/* Name & Role */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
                {fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl text-orange-400 font-medium">{member.role}</span>
                {member.department && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">{member.department}</span>
                  </>
                )}
              </div>
              {(member.yearsOfService || member.joinedDate) && (
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  {member.yearsOfService && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {member.yearsOfService} {t.yearsOfService}
                    </div>
                  )}
                  {member.joinedDate && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t.joinedDate} {member.joinedDate}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bio Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.biography}
              </h2>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {member.bio || t.noBio}
                </p>
              </div>
            </div>

            {/* Experience Section */}
            {member.experience && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.experience}
                </h2>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{member.experience}</p>
                </div>
              </div>
            )}

            {/* Education Section */}
            {member.education && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  {t.education}
                </h2>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <p className="text-slate-300 leading-relaxed">{member.education}</p>
                </div>
              </div>
            )}

            {/* Achievements Section */}
            {member.achievements && member.achievements.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {t.achievements}
                </h2>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <ul className="space-y-3">
                    {member.achievements.map((achievement, index) => (
                      <li key={index} className="flex items-start gap-3 text-slate-300">
                        <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Contact Section */}
            {hasContact && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.contact}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.email}</p>
                        <p className="text-white font-medium">{member.email}</p>
                      </div>
                    </a>
                  )}
                  {member.phone && (
                    <a
                      href={`tel:${member.phone}`}
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.phone}</p>
                        <p className="text-white font-medium">{member.phone}</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Other Members */}
        {otherMembers.length > 0 && (
          <section className="border-t border-white/5 pt-8 sm:pt-12 lg:pt-16">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">
              {memberType === "commission" ? t.otherCommissionMembers : t.otherMembers}
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {otherMembers.map((other) => (
                <Link
                  key={other.id}
                  href={`/staff/${other.id}`}
                  className={`group relative overflow-hidden rounded-lg sm:rounded-2xl border border-white/5 bg-white/[0.02] transition-all ${
                    memberType === "commission" 
                      ? "hover:border-blue-500/30 hover:bg-blue-500/5" 
                      : "hover:border-orange-500/30 hover:bg-orange-500/5"
                  }`}
                >
                  <div className="aspect-square sm:aspect-[4/5] relative">
                    {other.photo ? (
                      <Image
                        src={other.photo}
                        alt={other.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/50 to-slate-900">
                        <div className={`flex h-10 w-10 sm:h-20 sm:w-20 items-center justify-center rounded-full text-base sm:text-3xl font-bold text-white ${
                          memberType === "commission"
                            ? "bg-gradient-to-br from-blue-500 to-blue-600"
                            : "bg-gradient-to-br from-orange-500 to-orange-600"
                        }`}>
                          {other.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-4">
                      <p className="text-[10px] sm:text-base font-semibold text-white truncate">{other.name}</p>
                      <p className={`text-[8px] sm:text-sm truncate ${memberType === "commission" ? "text-blue-400" : "text-orange-400"}`}>{other.role}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
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
