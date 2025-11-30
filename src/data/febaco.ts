export type SpotlightPlayer = {
  name: string;
  position: string;
  team: string;
  stats: string;
  efficiency: string;
  blurb: string;
  number: number;
  statLines: {
    label: string;
    value: string;
  }[];
  leaderboard: {
    pts: number;
    ast: number;
    reb: number;
    blk: number;
  };
  photo: string;
};

export type GameResult = {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: string;
  venue: string;
  broadcast: string;
};

export type ScheduleEntry = {
  id: string;
  date: string;
  time: string;
  venue: string;
  home: string;
  away: string;
};

export type NewsArticle = {
  id: string;
  category: string;
  title: string;
  summary: string;
  published: string;
};

export type StatMetric = {
  label: string;
  value: string;
  change: string;
};

export type StandingRow = {
  seed: number;
  team: string;
  wins: number;
  losses: number;
  streak: string;
  lastTen: string;
};

export type Franchise = {
  city: string;
  name: string;
  colors: [string, string];
  logo?: string;
};

export type RosterPlayer = {
  name: string;
  number: number;
  height: string;
  stats: {
    pts: string;
    reb: string;
    stl: string;
  };
};

export type FeaturedMatchup = {
  id: string;
  status: string;
  tipoff: string;
  venue: string;
  network: string;
  home: {
    team: string;
    record: string;
  };
  away: {
    team: string;
    record: string;
  };
  leaders: {
    player: string;
    team: string;
    stats: string;
  }[];
};

export const navSections = [
  "Schedule",
  "Players",
  "News",
  "Standings",
  "Teams",
];

export const spotlightPlayers: SpotlightPlayer[] = [
  {
    name: "Malik Kasongo",
    position: "F",
    team: "Espoir Fukash",
    stats: "20.5 PPG | 8.1 REB",
    efficiency: "+11.8",
    blurb: "Espoir's rangy forward toggles between backline rim contests and ball pressure traps.",
    number: 32,
    statLines: [
      { label: "Points", value: "20.5" },
      { label: "Rebounds", value: "8.1" },
      { label: "Steals", value: "1.5" },
      { label: "Blocks", value: "1.7" },
    ],
    leaderboard: {
      pts: 20.5,
      ast: 2.4,
      reb: 8.1,
      blk: 1.7,
    },
    photo: "/players/malik-kasongo.svg",
  },
  {
    name: "Shane Wallace",
    position: "G",
    team: "Ballers",
    stats: "21.5 PPG | 2.9 STL",
    efficiency: "+13.4",
    blurb: "On-ball terror who turns live-ball steals into instant offense for Ballers' pace attack.",
    number: 1,
    statLines: [
      { label: "Points", value: "21.5" },
      { label: "Assists", value: "5.2" },
      { label: "Steals", value: "2.9" },
      { label: "3PT%", value: "38%" },
    ],
    leaderboard: {
      pts: 21.5,
      ast: 5.2,
      reb: 3.5,
      blk: 0.3,
    },
    photo: "/players/shane-wallace.svg",
  },
  {
    name: "Serge Mapendo",
    position: "C",
    team: "City Kauka",
    stats: "13.4 PPG | 2.7 BLK",
    efficiency: "+8.2",
    blurb: "City Kauka protects the rim through Mapendo's verticality and late contests in drop coverage.",
    number: 42,
    statLines: [
      { label: "Points", value: "13.4" },
      { label: "Rebounds", value: "10.7" },
      { label: "Blocks", value: "2.7" },
      { label: "Steals", value: "0.6" },
    ],
    leaderboard: {
      pts: 13.4,
      ast: 1.4,
      reb: 10.7,
      blk: 2.7,
    },
    photo: "/players/serge-mapendo.svg",
  },
  {
    name: "Jonas Beya",
    position: "G",
    team: "Don Bosco",
    stats: "16.2 PPG | 6.8 AST",
    efficiency: "+9.1",
    blurb: "Don Bosco's lead guard toggles tempo and keeps their motion offense flowing.",
    number: 2,
    statLines: [
      { label: "Points", value: "16.2" },
      { label: "Assists", value: "6.8" },
      { label: "Steals", value: "1.7" },
      { label: "FT%", value: "86%" },
    ],
    leaderboard: {
      pts: 16.2,
      ast: 6.8,
      reb: 4.0,
      blk: 0.4,
    },
    photo: "/players/jonas-beya.svg",
  },
];

export const spotlightPlayersWomen: SpotlightPlayer[] = [
  {
    name: "Amina Ngalula",
    position: "G",
    team: "CNSS",
    stats: "18.3 PPG | 6.1 AST",
    efficiency: "+12.5",
    blurb: "CNSS drives tempo through Ngalula's bursts in transition and no-dribble swing threes.",
    number: 5,
    statLines: [
      { label: "Points", value: "18.3" },
      { label: "Assists", value: "6.1" },
      { label: "Steals", value: "2.4" },
      { label: "3PT%", value: "41%" },
    ],
    leaderboard: {
      pts: 18.3,
      ast: 6.1,
      reb: 4.2,
      blk: 0.5,
    },
    photo: "/players/amina-ngalula.svg",
  },
  {
    name: "Ruth Mbuyi",
    position: "F",
    team: "Tourbillon",
    stats: "16.1 PPG | 9.0 REB",
    efficiency: "+10.7",
    blurb: "Tourbillon's switchable forward seals deep position and erases drives with long arms.",
    number: 11,
    statLines: [
      { label: "Points", value: "16.1" },
      { label: "Rebounds", value: "9.0" },
      { label: "Blocks", value: "1.6" },
      { label: "Steals", value: "1.3" },
    ],
    leaderboard: {
      pts: 16.1,
      ast: 3.4,
      reb: 9.0,
      blk: 1.6,
    },
    photo: "/players/ruth-mbuyi.svg",
  },
  {
    name: "Lila Katembo",
    position: "G",
    team: "Vita Club",
    stats: "14.8 PPG | 2.8 STL",
    efficiency: "+9.8",
    blurb: "Vita Club's pressure guard digs in at the nail and pulls up in rhythm from 18 feet.",
    number: 3,
    statLines: [
      { label: "Points", value: "14.8" },
      { label: "Steals", value: "2.8" },
      { label: "Assists", value: "4.9" },
      { label: "FT%", value: "88%" },
    ],
    leaderboard: {
      pts: 14.8,
      ast: 4.9,
      reb: 3.6,
      blk: 0.4,
    },
    photo: "/players/lila-katembo.svg",
  },
  {
    name: "Sandrine Ilondo",
    position: "C",
    team: "OGKS",
    stats: "12.4 PPG | 10.5 REB",
    efficiency: "+8.9",
    blurb: "OGKS leans on Ilondo's high-low passing and second-chance work on the glass.",
    number: 24,
    statLines: [
      { label: "Points", value: "12.4" },
      { label: "Rebounds", value: "10.5" },
      { label: "Blocks", value: "2.2" },
      { label: "Steals", value: "0.8" },
    ],
    leaderboard: {
      pts: 12.4,
      ast: 2.1,
      reb: 10.5,
      blk: 2.2,
    },
    photo: "/players/sandrine-ilondo.svg",
  },
];

export const latestGames: GameResult[] = [
  {
    id: "FEB2025-91",
    home: "New Gen",
    away: "Terreur",
    homeScore: 118,
    awayScore: 111,
    status: "Final",
    venue: "Stade des Martyrs",
    broadcast: "Liprobakin Live",
  },
  {
    id: "FEB2025-92",
    home: "SCTP",
    away: "Don Bosco",
    homeScore: 105,
    awayScore: 97,
    status: "Final",
    venue: "Limete",
    broadcast: "Prime Sports",
  },
  {
    id: "FEB2025-93",
    home: "Espoir Fukash",
    away: "Molokai",
    homeScore: 101,
    awayScore: 95,
    status: "Final",
    venue: "Stade de la Police",
    broadcast: "Liprobakin Stream",
  },
  {
    id: "FEB2025-94",
    home: "Ballers",
    away: "City Kauka",
    homeScore: 112,
    awayScore: 108,
    status: "Final",
    venue: "Limete",
    broadcast: "League Feed",
  },
];

export const upcomingSchedule: ScheduleEntry[] = [
  {
    id: "FEB-SCH-01",
    date: "Tue, Dec 16",
    time: "7:30 PM",
    venue: "Stade des Martyrs",
    home: "Terreur",
    away: "New Gen",
  },
  {
    id: "FEB-SCH-02",
    date: "Thu, Dec 18",
    time: "5:00 PM",
    venue: "Limete",
    home: "New Gen",
    away: "Don Bosco",
  },
  {
    id: "FEB-SCH-03",
    date: "Sat, Dec 20",
    time: "8:00 PM",
    venue: "Stade de la Police",
    home: "New Gen",
    away: "Espoir Fukash",
  },
  {
    id: "FEB-SCH-04",
    date: "Mon, Dec 22",
    time: "6:00 PM",
    venue: "Stade des Martyrs",
    home: "Molokai",
    away: "New Gen",
  },
  {
    id: "FEB-SCH-05",
    date: "Wed, Dec 24",
    time: "4:00 PM",
    venue: "Limete",
    home: "New Gen",
    away: "Ballers",
  },
  {
    id: "FEB-SCH-06",
    date: "Sat, Dec 27",
    time: "7:00 PM",
    venue: "Stade de la Police",
    home: "New Gen",
    away: "City Kauka",
  },
];

export const headlineNews: NewsArticle[] = [
  {
    id: "NEWS-001",
    category: "Spotlight",
    title: "Porter Drops 42 To Seal New Gen Sweep",
    summary:
      "Cam Porter punched in another 40-piece to keep New Gen unbeaten through the Showcase window.",
    published: "2h ago",
  },
  {
    id: "NEWS-002",
    category: "Transactions",
    title: "Terreur Adds Rim Protector Omar Greer",
    summary:
      "Length and timing at the rim bolsters Terreur's top-rated defense heading into the winter push.",
    published: "5h ago",
  },
  {
    id: "NEWS-003",
    category: "Feature",
    title: "Espoir Fukash Turns Defense Into Fuel",
    summary:
      "Malik Kasongo and the Espoir wing core forced 22 turnovers to climb within a game of Molokai.",
    published: "Yesterday",
  },
  {
    id: "NEWS-004",
    category: "Game Story",
    title: "New Gen Extends Rivalry Edge",
    summary:
      "Cam Porter went 12-for-12 at the line to close out Terreur in the latest showcase meeting.",
    published: "Moments ago",
  },
];

export const leagueStats: StatMetric[] = [
  { label: "League Pace", value: "101.7", change: "+1.4 vs last week" },
  { label: "Avg Efficiency", value: "114.2", change: "-0.6 vs last season" },
  { label: "Clutch Net", value: "+8.0", change: "New Gen (1st)" },
  { label: "3PT Volume", value: "40.8", change: "+2 attempts" },
  { label: "Paint Touches", value: "55%", change: "Molokai (lead)" },
  { label: "Turnover Rate", value: "12.1%", change: "Don Bosco (best)" },
  { label: "Deflections", value: "18.2", change: "Espoir (surge)" },
  { label: "Bench Net", value: "+3.7", change: "Ballers (spark)" },
];

export const conferenceStandings: StandingRow[] = [
  { seed: 1, team: "New Gen", wins: 15, losses: 2, streak: "W7", lastTen: "9-1" },
  { seed: 2, team: "Terreur", wins: 13, losses: 4, streak: "L1", lastTen: "7-3" },
  { seed: 3, team: "SCTP", wins: 11, losses: 6, streak: "W1", lastTen: "6-4" },
  { seed: 4, team: "Espoir Fukash", wins: 10, losses: 7, streak: "W3", lastTen: "7-3" },
  { seed: 5, team: "Molokai", wins: 9, losses: 8, streak: "W1", lastTen: "5-5" },
  { seed: 6, team: "Ballers", wins: 7, losses: 10, streak: "W1", lastTen: "4-6" },
  { seed: 7, team: "City Kauka", wins: 6, losses: 11, streak: "L1", lastTen: "4-6" },
  { seed: 8, team: "Don Bosco", wins: 5, losses: 12, streak: "W1", lastTen: "4-6" },
  { seed: 9, team: "DCMP", wins: 5, losses: 12, streak: "L2", lastTen: "3-7" },
];

export const conferenceStandingsWomen: StandingRow[] = [
  { seed: 1, team: "CNSS", wins: 11, losses: 1, streak: "W6", lastTen: "9-1" },
  { seed: 2, team: "Vita Club", wins: 10, losses: 2, streak: "W3", lastTen: "8-2" },
  { seed: 3, team: "Tourbillon", wins: 8, losses: 4, streak: "L1", lastTen: "7-3" },
  { seed: 4, team: "OGKS", wins: 7, losses: 5, streak: "W2", lastTen: "6-4" },
  { seed: 5, team: "Hatari", wins: 6, losses: 6, streak: "W1", lastTen: "5-5" },
];

export const featuredMatchups: FeaturedMatchup[] = [
  {
    id: "MATCH-001",
    status: "Upcoming",
    tipoff: "Nov 29 · 6:00 PM",
    venue: "Axis Pavilion",
    network: "Liprobakin+",
    home: {
      team: "New Gen",
      record: "15-2",
    },
    away: {
      team: "Terreur",
      record: "13-4",
    },
    leaders: [
      {
        player: "Cam Porter",
        team: "New Gen",
        stats: "31.4 PTS · 7.8 AST",
      },
      {
        player: "Omar Greer",
        team: "Terreur",
        stats: "18.0 PTS · 3.3 BLK",
      },
    ],
  },
  {
    id: "MATCH-003",
    status: "Upcoming",
    tipoff: "Nov 29 · 4:30 PM",
    venue: "Stade des Martyrs",
    network: "Liprobakin+",
    home: {
      team: "CNSS",
      record: "9-3",
    },
    away: {
      team: "Tourbillon",
      record: "8-4",
    },
    leaders: [
      {
        player: "Amina Ngalula",
        team: "CNSS",
        stats: "18.3 PTS · 6.1 AST",
      },
      {
        player: "Ruth Mbuyi",
        team: "Tourbillon",
        stats: "16.1 PTS · 9.0 REB",
      },
    ],
  },
  {
    id: "MATCH-002",
    status: "Upcoming",
    tipoff: "Nov 29 · 8:30 PM",
    venue: "Sky District",
    network: "Prime Sports",
    home: {
      team: "Ballers",
      record: "7-10",
    },
    away: {
      team: "City Kauka",
      record: "6-11",
    },
    leaders: [
      {
        player: "Shane Wallace",
        team: "Ballers",
        stats: "21.5 PTS · 2.9 STL",
      },
      {
        player: "Serge Mapendo",
        team: "City Kauka",
        stats: "13.4 PTS · 2.7 BLK",
      },
    ],
  },
];

export const franchises: Franchise[] = [
  {
    city: "New",
    name: "Gen",
    colors: ["#38bdf8", "#a855f7"],
    logo: "/logos/New Gen.png",
  },
  {
    city: "",
    name: "Terreur",
    colors: ["#ef4444", "#0f172a"],
    logo: "/logos/terreur.jpg",
  },
  {
    city: "",
    name: "SCTP",
    colors: ["#22d3ee", "#0ea5e9"],
    logo: "/logos/sctp.jpg",
  },
  {
    city: "",
    name: "Molokai",
    colors: ["#fbbf24", "#fb923c"],
    logo: "/logos/molokai.jpg",
  },
  {
    city: "",
    name: "Ballers",
    colors: ["#cbd5f5", "#3b82f6"],
    logo: "/logos/Ballers.jpg",
  },
  {
    city: "Espoir",
    name: "Fukash",
    colors: ["#4ade80", "#15803d"],
    logo: "/logos/Espoir Fukash.png",
  },
  {
    city: "City",
    name: "Kauka",
    colors: ["#67e8f9", "#0ea5e9"],
    logo: "/logos/City kauka.png",
  },
  {
    city: "Don",
    name: "Bosco",
    colors: ["#fcd34d", "#f97316"],
    logo: "/logos/don bosco.jpg",
  },
  {
    city: "",
    name: "One Team",
    colors: ["#f472b6", "#be185d"],
  },
  {
    city: "",
    name: "Ngaliema",
    colors: ["#2dd4bf", "#0f766e"],
  },
  {
    city: "",
    name: "Opportunidade",
    colors: ["#fb923c", "#ea580c"],
  },
  {
    city: "",
    name: "J&A",
    colors: ["#c4b5fd", "#9333ea"],
  },
  {
    city: "",
    name: "Raphael",
    colors: ["#fde047", "#facc15"],
  },
  {
    city: "",
    name: "Bana Lingwala",
    colors: ["#4ade80", "#16a34a"],
  },
  {
    city: "",
    name: "Binza City",
    colors: ["#60a5fa", "#2563eb"],
  },
  {
    city: "",
    name: "NMG",
    colors: ["#38bdf8", "#0284c7"],
  },
  {
    city: "",
    name: "Rich",
    colors: ["#fda4af", "#fb7185"],
  },
  {
    city: "",
    name: "Heritage",
    colors: ["#facc15", "#d97706"],
  },
  {
    city: "",
    name: "Figuier",
    colors: ["#a5b4fc", "#6366f1"],
  },
  {
    city: "",
    name: "Masano",
    colors: ["#34d399", "#047857"],
  },
  {
    city: "",
    name: "Marche de la Liberte",
    colors: ["#fb7185", "#be123c"],
  },
  {
    city: "",
    name: "CSM",
    colors: ["#ec4899", "#9333ea"],
  },
  {
    city: "",
    name: "Ngaba Bagait Center",
    colors: ["#fcd34d", "#fb923c"],
  },
  {
    city: "",
    name: "Jourdain",
    colors: ["#93c5fd", "#3b82f6"],
  },
];

export const franchisesWomen: Franchise[] = [
  {
    city: "",
    name: "CNSS",
    colors: ["#22d3ee", "#0f172a"],
  },
  {
    city: "",
    name: "Tourbillon",
    colors: ["#f472b6", "#9333ea"],
  },
  {
    city: "",
    name: "Hatari",
    colors: ["#fb7185", "#9f1239"],
  },
  {
    city: "",
    name: "Vita Club",
    colors: ["#34d399", "#047857"],
  },
  {
    city: "",
    name: "OGKS",
    colors: ["#fde047", "#f97316"],
  },
  {
    city: "",
    name: "Saint Hilaire",
    colors: ["#fda4af", "#f43f5e"],
  },
  {
    city: "",
    name: "Raphael",
    colors: ["#fde047", "#facc15"],
  },
  {
    city: "",
    name: "Mboka Mboka",
    colors: ["#86efac", "#22c55e"],
  },
  {
    city: "",
    name: "Heritage",
    colors: ["#facc15", "#d97706"],
  },
  {
    city: "",
    name: "Jourdain",
    colors: ["#a5f3fc", "#06b6d4"],
  },
  {
    city: "",
    name: "INRI",
    colors: ["#c084fc", "#7c3aed"],
  },
  {
    city: "",
    name: "Ngaba",
    colors: ["#fcd34d", "#eab308"],
  },
  {
    city: "",
    name: "Yolo",
    colors: ["#38bdf8", "#0ea5e9"],
  },
  {
    city: "",
    name: "Yellow Center",
    colors: ["#fef08a", "#eab308"],
  },
  {
    city: "",
    name: "Ajakin",
    colors: ["#c7d2fe", "#6366f1"],
  },
  {
    city: "",
    name: "Maison des Jeunes",
    colors: ["#c4b5fd", "#8b5cf6"],
  },
];

export const teamRosters: Record<string, RosterPlayer[]> = {
  "New Gen": [
    { name: "Glory Mukendi", number: 15, height: "6'5\"", stats: { pts: "12.4", reb: "4.8", stl: "1.3" } },
    { name: "Cam Porter", number: 3, height: "6'4\"", stats: { pts: "27.8", reb: "4.3", stl: "1.7" } },
    { name: "Seyi Bongo", number: 8, height: "6'9\"", stats: { pts: "16.1", reb: "9.0", stl: "1.1" } },
    { name: "Drew Nsimba", number: 12, height: "6'6\"", stats: { pts: "11.4", reb: "5.8", stl: "1.4" } },
    { name: "Langston Mbaye", number: 1, height: "6'1\"", stats: { pts: "8.9", reb: "2.1", stl: "2.3" } },
  ],
  "Terreur": [
    { name: "Beny Bulambu", number: 18, height: "6'7\"", stats: { pts: "14.6", reb: "6.3", stl: "1.2" } },
    { name: "Omar Greer", number: 14, height: "6'11\"", stats: { pts: "18.7", reb: "10.2", stl: "0.8" } },
    { name: "Nikita Eloko", number: 5, height: "6'5\"", stats: { pts: "13.9", reb: "3.4", stl: "1.6" } },
    { name: "Bryce Tuta", number: 22, height: "6'8\"", stats: { pts: "9.8", reb: "7.1", stl: "1.0" } },
    { name: "Ian Kabasele", number: 2, height: "6'2\"", stats: { pts: "7.6", reb: "2.5", stl: "2.4" } },
  ],
  "SCTP": [
    { name: "David Mubenga", number: 23, height: "6'8\"", stats: { pts: "11.6", reb: "7.1", stl: "0.9" } },
    { name: "Jaylen Muamba", number: 6, height: "6'6\"", stats: { pts: "17.0", reb: "6.0", stl: "1.2" } },
    { name: "Theo Kiala", number: 0, height: "6'3\"", stats: { pts: "12.3", reb: "3.0", stl: "1.9" } },
    { name: "Patrick Olonga", number: 34, height: "6'10\"", stats: { pts: "8.7", reb: "8.1", stl: "0.6" } },
    { name: "Frank Dondo", number: 11, height: "6'4\"", stats: { pts: "10.1", reb: "4.2", stl: "1.5" } },
  ],
  "Molokai": [
    { name: "Eli Lufuma", number: 21, height: "6'7\"", stats: { pts: "15.6", reb: "7.3", stl: "1.0" } },
    { name: "Chris Moke", number: 4, height: "6'2\"", stats: { pts: "11.9", reb: "3.1", stl: "1.8" } },
    { name: "Ralph Kianza", number: 17, height: "6'10\"", stats: { pts: "9.2", reb: "9.0", stl: "0.5" } },
    { name: "Zeke Wema", number: 30, height: "6'5\"", stats: { pts: "7.4", reb: "4.1", stl: "1.3" } },
  ],
  "Ballers": [
    { name: "Abel Boteya", number: 9, height: "6'6\"", stats: { pts: "14.1", reb: "5.5", stl: "1.1" } },
    { name: "Shane Wallace", number: 1, height: "6'3\"", stats: { pts: "21.5", reb: "3.5", stl: "2.9" } },
    { name: "Jordan Mavungu", number: 45, height: "6'10\"", stats: { pts: "13.0", reb: "9.4", stl: "0.7" } },
    { name: "Kyle Mbuyi", number: 7, height: "6'5\"", stats: { pts: "12.7", reb: "5.0", stl: "1.4" } },
    { name: "Ovie Bukasa", number: 14, height: "6'1\"", stats: { pts: "6.8", reb: "2.3", stl: "1.9" } },
  ],
  "Espoir Fukash": [
    { name: "Malik Kasongo", number: 32, height: "6'8\"", stats: { pts: "20.5", reb: "8.1", stl: "1.5" } },
    { name: "Yannick Ilunga", number: 10, height: "6'4\"", stats: { pts: "11.4", reb: "3.7", stl: "2.1" } },
    { name: "Joel Kazadi", number: 50, height: "6'11\"", stats: { pts: "9.9", reb: "9.8", stl: "0.9" } },
    { name: "Marcel Onana", number: 6, height: "6'2\"", stats: { pts: "7.2", reb: "2.6", stl: "2.5" } },
  ],
  "City Kauka": [
    { name: "Serge Mapendo", number: 42, height: "6'11\"", stats: { pts: "13.4", reb: "10.7", stl: "0.6" } },
    { name: "Jeff Kafuti", number: 13, height: "6'6\"", stats: { pts: "12.2", reb: "6.2", stl: "1.1" } },
    { name: "Mark-Ony Kanza", number: 2, height: "6'1\"", stats: { pts: "8.3", reb: "3.0", stl: "2.0" } },
    { name: "Isaac Banza", number: 24, height: "6'8\"", stats: { pts: "9.6", reb: "7.5", stl: "0.9" } },
  ],
  "Don Bosco": [
    { name: "Jonas Beya", number: 2, height: "6'2\"", stats: { pts: "16.2", reb: "5.0", stl: "1.7" } },
    { name: "Ricky Kanku", number: 44, height: "6'9\"", stats: { pts: "12.1", reb: "8.6", stl: "0.8" } },
    { name: "Steph Kanga", number: 11, height: "6'4\"", stats: { pts: "10.0", reb: "3.8", stl: "1.9" } },
    { name: "Herve Lungwana", number: 7, height: "6'6\"", stats: { pts: "8.4", reb: "4.5", stl: "1.3" } },
  ],
  "One Team": [
    { name: "Caleb Ilunga", number: 5, height: "6'5\"", stats: { pts: "15.2", reb: "6.2", stl: "1.4" } },
    { name: "Merveille Ngandu", number: 9, height: "6'8\"", stats: { pts: "12.8", reb: "8.5", stl: "0.9" } },
    { name: "Junior Kabuya", number: 21, height: "6'2\"", stats: { pts: "9.6", reb: "3.1", stl: "1.8" } },
    { name: "Patrick Mukenzi", number: 13, height: "6'10\"", stats: { pts: "7.9", reb: "9.4", stl: "0.7" } },
  ],
  Ngaliema: [
    { name: "Kevin Banza", number: 4, height: "6'4\"", stats: { pts: "14.4", reb: "5.3", stl: "1.2" } },
    { name: "Hope Malemba", number: 12, height: "6'7\"", stats: { pts: "11.2", reb: "7.9", stl: "1.1" } },
    { name: "Rickson Kangulu", number: 33, height: "6'9\"", stats: { pts: "10.6", reb: "8.1", stl: "0.8" } },
    { name: "Cedric Kafubu", number: 2, height: "6'1\"", stats: { pts: "8.8", reb: "2.4", stl: "2.0" } },
  ],
  Opportunidade: [
    { name: "Andre Panzu", number: 11, height: "6'6\"", stats: { pts: "15.9", reb: "6.0", stl: "1.0" } },
    { name: "Wilfried Senga", number: 24, height: "6'8\"", stats: { pts: "12.1", reb: "9.2", stl: "0.6" } },
    { name: "Christ Yanonge", number: 7, height: "6'3\"", stats: { pts: "9.4", reb: "3.7", stl: "1.5" } },
    { name: "Victor Ngimbi", number: 18, height: "6'10\"", stats: { pts: "8.6", reb: "8.8", stl: "0.7" } },
  ],
  "J&A": [
    { name: "Lionel Bote", number: 8, height: "6'5\"", stats: { pts: "13.7", reb: "5.9", stl: "1.1" } },
    { name: "Cedrick Moke", number: 16, height: "6'9\"", stats: { pts: "11.5", reb: "9.0", stl: "0.9" } },
    { name: "Tresor Luyeye", number: 3, height: "6'0\"", stats: { pts: "10.2", reb: "2.8", stl: "2.4" } },
    { name: "Blaise Kaputu", number: 44, height: "6'7\"", stats: { pts: "7.1", reb: "6.3", stl: "1.0" } },
  ],
  Raphael: [
    { name: "Ruben Malu", number: 1, height: "6'2\"", stats: { pts: "14.9", reb: "4.1", stl: "1.9" } },
    { name: "Diego Lombi", number: 20, height: "6'8\"", stats: { pts: "12.5", reb: "7.8", stl: "0.8" } },
    { name: "Prince Ngwala", number: 15, height: "6'6\"", stats: { pts: "10.7", reb: "6.4", stl: "1.1" } },
    { name: "Kevin Mulunda", number: 32, height: "6'10\"", stats: { pts: "8.2", reb: "8.9", stl: "0.6" } },
  ],
  "Bana Lingwala": [
    { name: "Jacques Kaba", number: 6, height: "6'4\"", stats: { pts: "13.1", reb: "5.0", stl: "1.6" } },
    { name: "Hugo Mukanya", number: 13, height: "6'7\"", stats: { pts: "11.3", reb: "7.2", stl: "1.0" } },
    { name: "Fabrice Kitoko", number: 23, height: "6'3\"", stats: { pts: "9.0", reb: "3.6", stl: "2.1" } },
    { name: "Ralph Bokele", number: 50, height: "6'9\"", stats: { pts: "8.4", reb: "8.5", stl: "0.7" } },
  ],
  "Binza City": [
    { name: "Ashley Pasi", number: 4, height: "6'2\"", stats: { pts: "15.0", reb: "4.6", stl: "1.3" } },
    { name: "Boris Ilumbe", number: 31, height: "6'8\"", stats: { pts: "12.0", reb: "8.3", stl: "0.9" } },
    { name: "Kelvin Samba", number: 11, height: "6'5\"", stats: { pts: "9.5", reb: "5.2", stl: "1.4" } },
    { name: "Oscar Tumba", number: 19, height: "6'10\"", stats: { pts: "7.7", reb: "9.1", stl: "0.6" } },
  ],
  NMG: [
    { name: "Tracy Mavinga", number: 0, height: "6'1\"", stats: { pts: "16.4", reb: "4.0", stl: "2.2" } },
    { name: "Jordan Kitenge", number: 28, height: "6'8\"", stats: { pts: "11.6", reb: "8.7", stl: "0.8" } },
    { name: "Ulrich Sanda", number: 9, height: "6'5\"", stats: { pts: "10.9", reb: "5.6", stl: "1.1" } },
    { name: "Yves Biyombo", number: 17, height: "6'10\"", stats: { pts: "8.1", reb: "9.9", stl: "0.5" } },
  ],
  Rich: [
    { name: "Didier Kenga", number: 2, height: "6'3\"", stats: { pts: "15.7", reb: "4.9", stl: "1.5" } },
    { name: "Michel Lobo", number: 14, height: "6'7\"", stats: { pts: "11.9", reb: "7.6", stl: "0.9" } },
    { name: "Samuel Kikuni", number: 25, height: "6'5\"", stats: { pts: "9.7", reb: "5.5", stl: "1.2" } },
    { name: "Glen Mavinga", number: 45, height: "6'9\"", stats: { pts: "7.5", reb: "8.7", stl: "0.6" } },
  ],
  Heritage: [
    { name: "Marcel Idengo", number: 10, height: "6'4\"", stats: { pts: "14.8", reb: "5.2", stl: "1.7" } },
    { name: "Noel Sikobe", number: 34, height: "6'8\"", stats: { pts: "12.4", reb: "8.0", stl: "0.9" } },
    { name: "Pierre Lolemba", number: 6, height: "6'2\"", stats: { pts: "9.9", reb: "3.3", stl: "1.5" } },
    { name: "Stephane Bobo", number: 55, height: "6'9\"", stats: { pts: "7.0", reb: "9.5", stl: "0.7" } },
  ],
  Figuier: [
    { name: "David Mukeba", number: 31, height: "6'6\"", stats: { pts: "13.2", reb: "6.7", stl: "1.1" } },
    { name: "Louis Mpasi", number: 5, height: "6'4\"", stats: { pts: "11.5", reb: "4.9", stl: "1.3" } },
    { name: "Albert Kabeya", number: 42, height: "6'9\"", stats: { pts: "9.3", reb: "8.8", stl: "0.8" } },
    { name: "Patrice Louya", number: 14, height: "6'2\"", stats: { pts: "8.4", reb: "3.1", stl: "1.9" } },
  ],
  Masano: [
    { name: "Yannick Maseka", number: 19, height: "6'5\"", stats: { pts: "14.0", reb: "6.0", stl: "1.2" } },
    { name: "Herve Kiboko", number: 33, height: "6'8\"", stats: { pts: "11.1", reb: "7.5", stl: "0.9" } },
    { name: "Rudy Kalonji", number: 4, height: "6'2\"", stats: { pts: "9.8", reb: "3.4", stl: "1.6" } },
    { name: "Seth Mputu", number: 27, height: "6'9\"", stats: { pts: "7.6", reb: "8.9", stl: "0.6" } },
  ],
  "Marche de la Liberte": [
    { name: "Jonah Wema", number: 12, height: "6'3\"", stats: { pts: "15.3", reb: "4.8", stl: "1.8" } },
    { name: "Hector Mudi", number: 40, height: "6'9\"", stats: { pts: "12.0", reb: "9.6", stl: "0.7" } },
    { name: "Osée Bikuku", number: 6, height: "6'5\"", stats: { pts: "10.2", reb: "5.5", stl: "1.2" } },
    { name: "Lucien Kumbo", number: 3, height: "6'1\"", stats: { pts: "8.3", reb: "2.8", stl: "2.3" } },
  ],
  CSM: [
    { name: "Ethan Tati", number: 14, height: "6'6\"", stats: { pts: "13.6", reb: "6.4", stl: "1.1" } },
    { name: "Prince Nzuzi", number: 8, height: "6'3\"", stats: { pts: "11.0", reb: "4.2", stl: "1.7" } },
    { name: "Joel Bidi", number: 24, height: "6'9\"", stats: { pts: "9.1", reb: "8.7", stl: "0.6" } },
    { name: "Marlon Nono", number: 2, height: "6'1\"", stats: { pts: "7.8", reb: "2.5", stl: "2.0" } },
  ],
  "Ngaba Bagait Center": [
    { name: "Chris Kazanga", number: 30, height: "6'7\"", stats: { pts: "14.1", reb: "7.4", stl: "1.0" } },
    { name: "Junior Pangi", number: 17, height: "6'9\"", stats: { pts: "11.7", reb: "9.3", stl: "0.8" } },
    { name: "Larry Mobutu", number: 10, height: "6'2\"", stats: { pts: "9.9", reb: "3.2", stl: "1.5" } },
    { name: "Claude Tumba", number: 5, height: "6'5\"", stats: { pts: "8.5", reb: "5.8", stl: "1.1" } },
  ],
  "Jourdain": [
    { name: "Ricky Tshanda", number: 1, height: "6'4\"", stats: { pts: "15.5", reb: "5.0", stl: "1.9" } },
    { name: "Eben Kanku", number: 11, height: "6'7\"", stats: { pts: "12.2", reb: "7.4", stl: "1.0" } },
    { name: "Ozias Mulonda", number: 20, height: "6'5\"", stats: { pts: "10.4", reb: "5.7", stl: "1.3" } },
    { name: "Terry Mputu", number: 34, height: "6'9\"", stats: { pts: "8.0", reb: "8.6", stl: "0.7" } },
  ],
  "women:CNSS": [
    { name: "Amina Ngalula", number: 5, height: "5'10\"", stats: { pts: "18.3", reb: "4.2", stl: "2.4" } },
    { name: "Dora Kalala", number: 11, height: "6'1\"", stats: { pts: "14.0", reb: "7.3", stl: "1.1" } },
    { name: "Ketsia Lumbwe", number: 22, height: "6'2\"", stats: { pts: "10.6", reb: "8.5", stl: "0.9" } },
    { name: "Naomi Kaba", number: 2, height: "5'7\"", stats: { pts: "8.4", reb: "3.2", stl: "2.1" } },
  ],
  "women:Tourbillon": [
    { name: "Ruth Mbuyi", number: 11, height: "6'1\"", stats: { pts: "16.1", reb: "9.0", stl: "1.3" } },
    { name: "Micheline Kanza", number: 3, height: "5'9\"", stats: { pts: "12.0", reb: "5.1", stl: "1.4" } },
    { name: "Sabine Konda", number: 15, height: "6'0\"", stats: { pts: "9.4", reb: "6.8", stl: "1.0" } },
    { name: "Ida Mbayo", number: 1, height: "5'6\"", stats: { pts: "7.5", reb: "2.7", stl: "2.2" } },
  ],
  "women:Hatari": [
    { name: "Flora Mabanza", number: 10, height: "5'11\"", stats: { pts: "15.0", reb: "7.0", stl: "1.5" } },
    { name: "Celine Moke", number: 20, height: "6'2\"", stats: { pts: "11.0", reb: "8.4", stl: "0.8" } },
    { name: "Kelly Ntaba", number: 4, height: "5'8\"", stats: { pts: "8.8", reb: "4.0", stl: "2.1" } },
    { name: "Bella Toya", number: 33, height: "6'0\"", stats: { pts: "7.1", reb: "6.1", stl: "1.0" } },
  ],
  "women:Vita Club": [
    { name: "Lila Katembo", number: 3, height: "5'9\"", stats: { pts: "14.8", reb: "3.6", stl: "2.8" } },
    { name: "Sandra Nsimba", number: 25, height: "6'0\"", stats: { pts: "12.6", reb: "6.9", stl: "1.0" } },
    { name: "Tania Bokele", number: 8, height: "5'10\"", stats: { pts: "9.1", reb: "5.2", stl: "1.7" } },
    { name: "Christelle Moke", number: 14, height: "6'2\"", stats: { pts: "8.3", reb: "7.8", stl: "0.9" } },
  ],
  "women:OGKS": [
    { name: "Sandrine Ilondo", number: 24, height: "6'3\"", stats: { pts: "12.4", reb: "10.5", stl: "0.8" } },
    { name: "Faith Bijou", number: 9, height: "5'11\"", stats: { pts: "11.3", reb: "7.1", stl: "1.1" } },
    { name: "Marlyne Kapinga", number: 5, height: "5'8\"", stats: { pts: "9.2", reb: "4.9", stl: "1.6" } },
    { name: "Olive Mbaki", number: 17, height: "6'0\"", stats: { pts: "7.0", reb: "6.2", stl: "0.9" } },
  ],
  "women:Saint Hilaire": [
    { name: "Josée Lukusa", number: 6, height: "5'10\"", stats: { pts: "13.3", reb: "6.1", stl: "1.4" } },
    { name: "Imelda Sakina", number: 2, height: "5'7\"", stats: { pts: "11.0", reb: "3.5", stl: "2.0" } },
    { name: "Rachel Diangi", number: 18, height: "6'1\"", stats: { pts: "9.6", reb: "7.4", stl: "0.7" } },
    { name: "Anita Mboyo", number: 12, height: "5'9\"", stats: { pts: "7.8", reb: "4.8", stl: "1.1" } },
  ],
  "women:Raphael": [
    { name: "Kendra Batubenga", number: 1, height: "5'9\"", stats: { pts: "14.5", reb: "5.0", stl: "2.2" } },
    { name: "Sylvie Kanda", number: 11, height: "6'0\"", stats: { pts: "11.7", reb: "7.0", stl: "0.9" } },
    { name: "Dalia Mweni", number: 7, height: "5'8\"", stats: { pts: "9.3", reb: "4.2", stl: "1.5" } },
    { name: "Edith Masala", number: 20, height: "6'1\"", stats: { pts: "8.0", reb: "6.3", stl: "0.8" } },
  ],
  "women:Mboka Mboka": [
    { name: "Prisca Ngoyi", number: 22, height: "5'11\"", stats: { pts: "13.0", reb: "7.2", stl: "1.2" } },
    { name: "Delphine Tshika", number: 4, height: "5'8\"", stats: { pts: "10.9", reb: "4.3", stl: "1.8" } },
    { name: "Debora Malu", number: 15, height: "6'2\"", stats: { pts: "9.7", reb: "8.0", stl: "0.9" } },
    { name: "Yvette Menga", number: 9, height: "5'9\"", stats: { pts: "7.5", reb: "5.1", stl: "1.3" } },
  ],
  "women:Heritage": [
    { name: "Loane Kimona", number: 8, height: "5'9\"", stats: { pts: "12.9", reb: "5.8", stl: "1.6" } },
    { name: "Merveille Keta", number: 21, height: "6'0\"", stats: { pts: "11.2", reb: "7.6", stl: "0.8" } },
    { name: "Ophelie Ngalula", number: 5, height: "5'7\"", stats: { pts: "9.0", reb: "3.6", stl: "2.0" } },
    { name: "Prisca Obala", number: 13, height: "5'11\"", stats: { pts: "7.8", reb: "6.1", stl: "1.0" } },
  ],
  "women:Jourdain": [
    { name: "Linda Mpawe", number: 3, height: "5'10\"", stats: { pts: "14.1", reb: "6.3", stl: "1.5" } },
    { name: "Betty Nkusu", number: 16, height: "6'0\"", stats: { pts: "11.4", reb: "7.0", stl: "0.9" } },
    { name: "Joelle Tondi", number: 6, height: "5'8\"", stats: { pts: "9.1", reb: "4.4", stl: "1.8" } },
    { name: "Sandra Kazumba", number: 24, height: "6'1\"", stats: { pts: "7.4", reb: "6.8", stl: "0.8" } },
  ],
  "women:INRI": [
    { name: "Mimi Kabasele", number: 12, height: "5'9\"", stats: { pts: "13.4", reb: "5.5", stl: "1.7" } },
    { name: "Odile Kanza", number: 30, height: "6'1\"", stats: { pts: "10.2", reb: "7.8", stl: "0.8" } },
    { name: "Regina Kololo", number: 2, height: "5'6\"", stats: { pts: "8.9", reb: "3.1", stl: "2.3" } },
    { name: "Alice Bute", number: 18, height: "6'0\"", stats: { pts: "7.2", reb: "6.4", stl: "0.9" } },
  ],
  "women:Ngaba": [
    { name: "Sonia Manzedi", number: 14, height: "5'8\"", stats: { pts: "12.6", reb: "5.0", stl: "1.9" } },
    { name: "Nina Ondo", number: 34, height: "6'1\"", stats: { pts: "10.8", reb: "7.2", stl: "0.7" } },
    { name: "Gloria Imani", number: 7, height: "5'7\"", stats: { pts: "9.2", reb: "3.8", stl: "1.6" } },
    { name: "Kelly Louya", number: 22, height: "5'11\"", stats: { pts: "7.0", reb: "6.0", stl: "0.9" } },
  ],
  "women:Yolo": [
    { name: "Trixie Mukandu", number: 1, height: "5'9\"", stats: { pts: "13.1", reb: "4.9", stl: "2.1" } },
    { name: "Rita Maku", number: 19, height: "6'0\"", stats: { pts: "11.5", reb: "6.8", stl: "0.8" } },
    { name: "Nadine Biyela", number: 9, height: "5'7\"", stats: { pts: "8.7", reb: "3.6", stl: "1.7" } },
    { name: "Hope Sangwa", number: 4, height: "5'10\"", stats: { pts: "7.6", reb: "5.9", stl: "1.0" } },
  ],
  "women:Yellow Center": [
    { name: "Dolly Maza", number: 23, height: "6'0\"", stats: { pts: "12.3", reb: "7.1", stl: "1.0" } },
    { name: "Irene Tshi", number: 8, height: "5'8\"", stats: { pts: "10.6", reb: "4.3", stl: "1.6" } },
    { name: "Lydia Sefu", number: 3, height: "5'9\"", stats: { pts: "9.1", reb: "5.4", stl: "1.2" } },
    { name: "Rachel Balu", number: 12, height: "6'1\"", stats: { pts: "7.4", reb: "6.5", stl: "0.9" } },
  ],
  "women:Ajakin": [
    { name: "Joy Mfwamba", number: 30, height: "5'10\"", stats: { pts: "12.8", reb: "6.0", stl: "1.3" } },
    { name: "Nadine Salumu", number: 6, height: "5'7\"", stats: { pts: "10.5", reb: "4.4", stl: "1.9" } },
    { name: "Clarisse Mayele", number: 18, height: "6'1\"", stats: { pts: "8.9", reb: "7.1", stl: "0.8" } },
    { name: "Belinda Ndundu", number: 11, height: "5'11\"", stats: { pts: "7.2", reb: "6.2", stl: "1.0" } },
  ],
  "women:Maison des Jeunes": [
    { name: "Gina Kaswera", number: 5, height: "5'9\"", stats: { pts: "13.0", reb: "5.5", stl: "1.8" } },
    { name: "Hawa Makanzu", number: 15, height: "6'0\"", stats: { pts: "10.7", reb: "6.9", stl: "0.9" } },
    { name: "Sabine Tuluka", number: 2, height: "5'7\"", stats: { pts: "8.6", reb: "3.7", stl: "1.5" } },
    { name: "Michelle Kiyombo", number: 24, height: "6'2\"", stats: { pts: "7.1", reb: "6.8", stl: "0.8" } },
  ],
};
