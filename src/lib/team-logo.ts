import { normalizeTeamName } from "@/lib/team-name";

type TeamLogoSource = {
  city?: string | null;
  name?: string | null;
  logo?: string | null;
};

const normalizeLogoKey = (city?: string | null, name?: string | null) => {
  return [city, name]
    .map((part) => normalizeTeamName(part ?? "").toLowerCase())
    .filter(Boolean)
    .join(" ")
    .trim();
};

export const teamLogoOverrides: Record<string, string> = {
  "chaux sport": "/logos/Males/chaux_sport.svg",
  chaux: "/logos/Males/chaux_sport.svg",
  "espoir fukas": "/logos/Males/Espoir Fukash.png",
  "espoir fukash": "/logos/Males/Espoir Fukash.png",
  "city kauka": "/logos/Males/city kauka.jpg",
  "binza city": "/logos/Males/binza_city.jpg",
  "ballers": "/logos/Males/Ballers.jpg",
  "nmg": "/logos/Males/nmg.jpg",
  "ngaba basket center": "/logos/Males/ngaba_basket_center.jpg",
  "ngaba basketball center": "/logos/Males/ngaba_basket_center.jpg",
  "tourbillon": "/logos/Females/tourbillon.jpg",
  "csm": "/logos/Males/csm.jpg",
  "raphael": "/logos/Males/raphael.jpg",
  "police": "/logos/Males/police.jpg",
  "bana lingwala": "/logos/Males/bana lingwala.jpg",
  "jourdain": "/logos/Males/jourdain.jpg",
  "hatari": "/logos/Females/hatari.jpg",
  "yellow center": "/logos/Females/yellow star.jpg",
  "one team": "/logos/Males/one_team.jpg",
  "cnss": "/logos/Females/cnss.jpg",
  "sctp": "/logos/Males/sctp.jpg",
  "ajakm": "/logos/Females/ajakm.jpg",
  "rich": "/logos/Males/rich.jpg",
  "molokai": "/logos/Males/molokai.jpg",
  "maison des jeunes": "/logos/Females/maison_des_jeunes.jpg",
  "opportunidade": "/logos/Males/oportunidade.jpg",
  "oportunidade": "/logos/Males/oportunidade.jpg",
  "yolo": "/logos/Females/yolo.jpg",
  "heritage": "/logos/Males/heritage.jpg",
  "figuier": "/logos/Males/figuier.jpg",
  "mboka mboka": "/logos/Females/mboka_mboka.jpg",
  "corridor de l'espoir": "/logos/Females/corridor de l'espoir.jpg",
  "marche de la liberte": "/logos/Males/marche_de_la liberte.jpg",
  "ngaliema": "/logos/Males/ngaliema.jpg",
  "terreur": "/logos/Males/terreur.jpg",
  "masano": "/logos/Males/masano.jpg",
  "vita club": "/logos/Females/vita_club.jpg",
  "j&a": "/logos/Males/j&a.jpg",
  "ogks": "/logos/Females/OGSK.jpg",
  "new gen": "/logos/Males/New_Gen.png",
  gen: "/logos/Males/New_Gen.png",
  "don bosco": "/logos/Females/don bosco.jpg",
  bosco: "/logos/Females/don bosco.jpg",
  inri: "/logos/Females/inri.jpg",
  dcmp: "/logos/liprobakin.png",
};

export const resolveTeamLogo = (team: TeamLogoSource, fallback = "/logos/liprobakin.png") => {
  const combinedKey = normalizeLogoKey(team.city, team.name);
  const nameOnlyKey = normalizeLogoKey(undefined, team.name);
  return teamLogoOverrides[combinedKey] ?? teamLogoOverrides[nameOnlyKey] ?? team.logo ?? fallback;
};