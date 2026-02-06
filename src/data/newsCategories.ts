export type NewsCategory = {
  id: string;
  label: string;
  labelFr: string;
  description: string;
  descriptionFr: string;
  parent?: string;
  icon?: string;
};

export const NEWS_CATEGORIES: NewsCategory[] = [
  // Breaking News & Headlines
  {
    id: "headlines",
    label: "Headlines / Breaking News",
    labelFr: "Gros titres / Dernière minute",
    description: "Major announcements, urgent news, and breaking stories",
    descriptionFr: "Annonces majeures, nouvelles urgentes et événements de dernière minute",
    icon: "🔥"
  },
  
  // Transfers & Transactions
  {
    id: "transfers",
    label: "Transfers / Trades",
    labelFr: "Transferts / Échanges",
    description: "Player movements, trade announcements, and transaction updates",
    descriptionFr: "Mouvements de joueurs, annonces d'échanges et mises à jour de transactions",
    parent: "transactions",
    icon: "🔄"
  },
  {
    id: "transactions",
    label: "Transactions",
    labelFr: "Transactions",
    description: "All team roster changes and signings",
    descriptionFr: "Tous les changements d'effectif et signatures",
    icon: "📝"
  },
  
  // Health & Injuries
  {
    id: "injuries",
    label: "Injuries & Health Updates",
    labelFr: "Blessures et santé",
    description: "Injury reports, recovery updates, and health status",
    descriptionFr: "Rapports de blessures, mises à jour de récupération et état de santé",
    parent: "health",
    icon: "🏥"
  },
  {
    id: "health",
    label: "Health",
    labelFr: "Santé",
    description: "Player health and medical updates",
    descriptionFr: "Santé des joueurs et mises à jour médicales",
    icon: "⚕️"
  },
  
  // Rumors & Reports
  {
    id: "rumors",
    label: "Rumors & Reports",
    labelFr: "Rumeurs et rapports",
    description: "Unconfirmed reports, speculation, and insider information",
    descriptionFr: "Rapports non confirmés, spéculations et informations d'initiés",
    icon: "👂"
  },
  
  // Game Coverage
  {
    id: "game-results",
    label: "Game Results / Recaps",
    labelFr: "Résultats / Résumés",
    description: "Post-game summaries, final scores, and match reports",
    descriptionFr: "Résumés après-match, scores finaux et rapports de match",
    parent: "games",
    icon: "📊"
  },
  {
    id: "game-previews",
    label: "Previews / Matchups",
    labelFr: "Aperçus / Affiches",
    description: "Upcoming game analysis, matchup breakdowns, and predictions",
    descriptionFr: "Analyse des matchs à venir, décryptage des affiches et prédictions",
    parent: "games",
    icon: "🔮"
  },
  {
    id: "games",
    label: "Games",
    labelFr: "Matchs",
    description: "Game coverage and match analysis",
    descriptionFr: "Couverture des matchs et analyses",
    icon: "🏀"
  },
  
  // Standings & Rankings
  {
    id: "standings",
    label: "Standings / Rankings",
    labelFr: "Classements",
    description: "League tables, team rankings, and playoff positions",
    descriptionFr: "Tableaux de classement, positions des équipes et playoffs",
    icon: "📈"
  },
  {
    id: "power-rankings",
    label: "Power Rankings",
    labelFr: "Classements de puissance",
    description: "Weekly team performance rankings and analysis",
    descriptionFr: "Classements hebdomadaires des performances d'équipes",
    icon: "💪"
  },
  
  // Press & Quotes
  {
    id: "press",
    label: "Press Conferences / Quotes",
    labelFr: "Conférences de presse / Citations",
    description: "Coach and player statements, press conference highlights",
    descriptionFr: "Déclarations d'entraîneurs et joueurs, moments forts des conférences",
    icon: "🎤"
  },
  
  // Player Focus
  {
    id: "player-spotlight",
    label: "Player Spotlight",
    labelFr: "Joueur à l'honneur",
    description: "Individual player features and performance highlights",
    descriptionFr: "Reportages individuels et moments forts des performances",
    parent: "player-focus",
    icon: "⭐"
  },
  {
    id: "player-profiles",
    label: "Player Profiles / Bios",
    labelFr: "Profils de joueurs",
    description: "In-depth player biographies and career stories",
    descriptionFr: "Biographies détaillées et parcours de carrière",
    parent: "player-focus",
    icon: "👤"
  },
  {
    id: "rookie-watch",
    label: "Rookie Watch",
    labelFr: "Surveillance des recrues",
    description: "Rookie performance tracking and development updates",
    descriptionFr: "Suivi des performances et développement des recrues",
    parent: "player-focus",
    icon: "🌟"
  },
  {
    id: "veteran-stories",
    label: "Veteran Stories",
    labelFr: "Histoires de vétérans",
    description: "Features on experienced players and their impact",
    descriptionFr: "Reportages sur les joueurs expérimentés et leur impact",
    parent: "player-focus",
    icon: "🏆"
  },
  {
    id: "player-focus",
    label: "Player Focus",
    labelFr: "Focus joueurs",
    description: "Individual player stories and profiles",
    descriptionFr: "Histoires et profils de joueurs individuels",
    icon: "👥"
  },
  
  // Team Focus
  {
    id: "team-spotlight",
    label: "Team Spotlight",
    labelFr: "Équipe à l'honneur",
    description: "Team-focused features and deep dives",
    descriptionFr: "Reportages et analyses approfondies sur les équipes",
    parent: "team-focus",
    icon: "🔦"
  },
  {
    id: "team-focus",
    label: "Team Focus",
    labelFr: "Focus équipes",
    description: "Team-centered stories and analysis",
    descriptionFr: "Histoires et analyses centrées sur les équipes",
    icon: "👕"
  },
  
  // Contracts & Career
  {
    id: "contracts",
    label: "Contract Extensions",
    labelFr: "Extensions de contrat",
    description: "Contract renewals, extensions, and negotiations",
    descriptionFr: "Renouvellements, extensions et négociations de contrats",
    icon: "✍️"
  },
  {
    id: "retirements",
    label: "Retirements",
    labelFr: "Retraites",
    description: "Player retirement announcements and farewell tributes",
    descriptionFr: "Annonces de retraite et hommages d'adieu",
    icon: "👋"
  },
  
  // Analysis & Deep Dives
  {
    id: "film-breakdown",
    label: "Film Breakdown",
    labelFr: "Analyse vidéo",
    description: "Detailed video analysis of plays and strategies",
    descriptionFr: "Analyse vidéo détaillée des actions et stratégies",
    parent: "analysis",
    icon: "🎬"
  },
  {
    id: "tactical-analysis",
    label: "Tactical Analysis",
    labelFr: "Analyse tactique",
    description: "Strategic breakdowns and coaching decisions",
    descriptionFr: "Décryptage stratégique et décisions d'entraîneurs",
    parent: "analysis",
    icon: "📋"
  },
  {
    id: "advanced-stats",
    label: "Advanced Stats / Analytics",
    labelFr: "Statistiques avancées",
    description: "Data-driven analysis and statistical insights",
    descriptionFr: "Analyse basée sur les données et insights statistiques",
    parent: "analysis",
    icon: "📊"
  },
  {
    id: "playbook",
    label: "Playbook / Strategy",
    labelFr: "Livre de jeu / Stratégie",
    description: "Play designs, offensive/defensive schemes",
    descriptionFr: "Conception de jeux, schémas offensifs/défensifs",
    parent: "analysis",
    icon: "📖"
  },
  {
    id: "opinion",
    label: "Opinion / Editorials",
    labelFr: "Opinion / Éditoriaux",
    description: "Columnist perspectives and editorial commentary",
    descriptionFr: "Perspectives de chroniqueurs et commentaires éditoriaux",
    parent: "analysis",
    icon: "💭"
  },
  {
    id: "scouting",
    label: "Scouting Reports",
    labelFr: "Rapports de dépistage",
    description: "Player evaluations and prospect analysis",
    descriptionFr: "Évaluations de joueurs et analyses de prospects",
    parent: "analysis",
    icon: "🔍"
  },
  {
    id: "analysis",
    label: "Analysis & Deep Dives",
    labelFr: "Analyses approfondies",
    description: "In-depth tactical and statistical analysis",
    descriptionFr: "Analyses tactiques et statistiques approfondies",
    icon: "🧠"
  },
  
  // Media & Highlights
  {
    id: "highlights",
    label: "Highlights / Top Plays",
    labelFr: "Moments forts / Meilleurs actions",
    description: "Best plays, game highlights, and standout moments",
    descriptionFr: "Meilleures actions, moments forts et performances exceptionnelles",
    parent: "media",
    icon: "⚡"
  },
  {
    id: "signature-plays",
    label: "Dunks / Blocks / Crossovers",
    labelFr: "Dunks / Contres / Dribbles",
    description: "Spectacular individual plays and skills",
    descriptionFr: "Actions individuelles spectaculaires et compétences",
    parent: "media",
    icon: "💥"
  },
  {
    id: "interviews",
    label: "Interviews",
    labelFr: "Entrevues",
    description: "One-on-one interviews with players and coaches",
    descriptionFr: "Entrevues individuelles avec joueurs et entraîneurs",
    parent: "media",
    icon: "🎙️"
  },
  {
    id: "behind-scenes",
    label: "Behind the Scenes",
    labelFr: "Dans les coulisses",
    description: "Exclusive access to team facilities and practices",
    descriptionFr: "Accès exclusif aux installations et entraînements",
    parent: "media",
    icon: "🎥"
  },
  {
    id: "media",
    label: "Media & Highlights",
    labelFr: "Médias et moments forts",
    description: "Video content and visual features",
    descriptionFr: "Contenu vidéo et reportages visuels",
    icon: "📹"
  },
  
  // League & Business
  {
    id: "league-news",
    label: "League Announcements",
    labelFr: "Annonces de la ligue",
    description: "Official league statements and policy changes",
    descriptionFr: "Déclarations officielles et changements de politique",
    parent: "league-business",
    icon: "📢"
  },
  {
    id: "rules",
    label: "CBA / Rules Changes",
    labelFr: "Convention / Changements de règles",
    description: "Collective bargaining and rule modifications",
    descriptionFr: "Négociation collective et modifications des règles",
    parent: "league-business",
    icon: "⚖️"
  },
  {
    id: "salary-cap",
    label: "Salary Cap News",
    labelFr: "Nouvelles du plafond salarial",
    description: "Salary cap updates and financial implications",
    descriptionFr: "Mises à jour du plafond salarial et implications financières",
    parent: "league-business",
    icon: "💰"
  },
  {
    id: "front-office",
    label: "Ownership / Front Office",
    labelFr: "Propriété / Bureau",
    description: "Management changes and organizational updates",
    descriptionFr: "Changements de direction et mises à jour organisationnelles",
    parent: "league-business",
    icon: "🏢"
  },
  {
    id: "coaching-changes",
    label: "Coaching Changes",
    labelFr: "Changements d'entraîneurs",
    description: "Coaching hires, fires, and staff movements",
    descriptionFr: "Embauches, licenciements et mouvements du personnel",
    parent: "league-business",
    icon: "👔"
  },
  {
    id: "league-business",
    label: "League & Business",
    labelFr: "Ligue et affaires",
    description: "League operations and business matters",
    descriptionFr: "Opérations de la ligue et questions commerciales",
    icon: "💼"
  },
  
  // Fan Engagement
  {
    id: "fan-zone",
    label: "Fan Zone",
    labelFr: "Zone des fans",
    description: "Fan perspectives, reactions, and community voices",
    descriptionFr: "Perspectives des fans, réactions et voix de la communauté",
    parent: "fan-engagement",
    icon: "🎭"
  },
  {
    id: "polls",
    label: "Polls & Debates",
    labelFr: "Sondages et débats",
    description: "Fan polls, debates, and interactive content",
    descriptionFr: "Sondages, débats et contenu interactif",
    parent: "fan-engagement",
    icon: "🗳️"
  },
  {
    id: "social-buzz",
    label: "Social Media Buzz",
    labelFr: "Buzz sur les réseaux sociaux",
    description: "Trending topics and viral moments",
    descriptionFr: "Sujets tendance et moments viraux",
    parent: "fan-engagement",
    icon: "📱"
  },
  {
    id: "fantasy",
    label: "Fantasy Basketball",
    labelFr: "Basketball fantastique",
    description: "Fantasy tips, rankings, and player outlooks",
    descriptionFr: "Conseils fantasy, classements et perspectives de joueurs",
    parent: "fan-engagement",
    icon: "🎮"
  },
  {
    id: "betting",
    label: "Betting / Odds",
    labelFr: "Paris / Cotes",
    description: "Betting lines, odds analysis, and predictions",
    descriptionFr: "Lignes de paris, analyses des cotes et prédictions",
    parent: "fan-engagement",
    icon: "🎲"
  },
  {
    id: "fan-engagement",
    label: "Fan Engagement",
    labelFr: "Engagement des fans",
    description: "Interactive fan content and community features",
    descriptionFr: "Contenu interactif et fonctionnalités communautaires",
    icon: "🙌"
  },
  
  // History & Culture
  {
    id: "throwback",
    label: "Throwback / History",
    labelFr: "Retour en arrière / Histoire",
    description: "Historical moments and nostalgic content",
    descriptionFr: "Moments historiques et contenu nostalgique",
    parent: "history-culture",
    icon: "⏪"
  },
  {
    id: "legends",
    label: "Legends & Hall of Fame",
    labelFr: "Légendes et temple de la renommée",
    description: "Tributes to basketball greats and hall of famers",
    descriptionFr: "Hommages aux grands du basketball et membres du temple",
    parent: "history-culture",
    icon: "🏅"
  },
  {
    id: "anniversaries",
    label: "Anniversaries",
    labelFr: "Anniversaires",
    description: "Commemorating historic dates and milestones",
    descriptionFr: "Commémoration de dates historiques et jalons",
    parent: "history-culture",
    icon: "🎂"
  },
  {
    id: "culture",
    label: "Basketball Culture",
    labelFr: "Culture du basketball",
    description: "Fashion, music, and cultural impact of basketball",
    descriptionFr: "Mode, musique et impact culturel du basketball",
    parent: "history-culture",
    icon: "🎨"
  },
  {
    id: "sneakers",
    label: "Sneakers / Gear",
    labelFr: "Baskets / Équipement",
    description: "Sneaker releases, equipment reviews, and gear news",
    descriptionFr: "Sorties de baskets, critiques d'équipement et nouvelles",
    parent: "history-culture",
    icon: "👟"
  },
  {
    id: "history-culture",
    label: "History & Culture",
    labelFr: "Histoire et culture",
    description: "Basketball heritage and cultural impact",
    descriptionFr: "Patrimoine et impact culturel du basketball",
    icon: "📜"
  },
  
  // Youth & Development
  {
    id: "high-school",
    label: "High School Basketball",
    labelFr: "Basketball lycéen",
    description: "High school tournaments and top prospects",
    descriptionFr: "Tournois lycéens et meilleurs prospects",
    parent: "youth-development",
    icon: "🎓"
  },
  {
    id: "college",
    label: "College Basketball",
    labelFr: "Basketball universitaire",
    description: "College game coverage and NCAA updates",
    descriptionFr: "Couverture universitaire et mises à jour NCAA",
    parent: "youth-development",
    icon: "🏫"
  },
  {
    id: "draft",
    label: "Draft Prospects",
    labelFr: "Prospects du repêchage",
    description: "Draft analysis, mock drafts, and prospect rankings",
    descriptionFr: "Analyse du repêchage, simulations et classements",
    parent: "youth-development",
    icon: "📝"
  },
  {
    id: "international",
    label: "International Prospects",
    labelFr: "Prospects internationaux",
    description: "International player scouting and global talent",
    descriptionFr: "Dépistage international et talents mondiaux",
    parent: "youth-development",
    icon: "🌍"
  },
  {
    id: "development",
    label: "G League / Development",
    labelFr: "G League / Développement",
    description: "Development league updates and player progression",
    descriptionFr: "Mises à jour des ligues de développement et progression",
    parent: "youth-development",
    icon: "📈"
  },
  {
    id: "youth-development",
    label: "Youth & Development",
    labelFr: "Jeunesse et développement",
    description: "Amateur and development basketball",
    descriptionFr: "Basketball amateur et développement",
    icon: "🌱"
  },
  
  // Events & Special Coverage
  {
    id: "all-star",
    label: "All-Star Weekend",
    labelFr: "Week-end des étoiles",
    description: "All-Star game coverage and festivities",
    descriptionFr: "Couverture du match des étoiles et festivités",
    parent: "events",
    icon: "⭐"
  },
  {
    id: "playoffs",
    label: "Playoffs",
    labelFr: "Séries éliminatoires",
    description: "Playoff coverage, brackets, and predictions",
    descriptionFr: "Couverture des séries, tableaux et prédictions",
    parent: "events",
    icon: "🏆"
  },
  {
    id: "finals",
    label: "Finals",
    labelFr: "Finales",
    description: "Championship series coverage and analysis",
    descriptionFr: "Couverture et analyse de la série de championnats",
    parent: "events",
    icon: "👑"
  },
  {
    id: "draft-night",
    label: "Draft Night",
    labelFr: "Soirée du repêchage",
    description: "Live draft coverage and pick analysis",
    descriptionFr: "Couverture en direct et analyse des choix",
    parent: "events",
    icon: "🎯"
  },
  {
    id: "training-camp",
    label: "Training Camp",
    labelFr: "Camp d'entraînement",
    description: "Preseason camp reports and roster battles",
    descriptionFr: "Rapports de camp et batailles pour l'effectif",
    parent: "events",
    icon: "🏋️"
  },
  {
    id: "events",
    label: "Events & Special Coverage",
    labelFr: "Événements et couverture spéciale",
    description: "Major basketball events and tournaments",
    descriptionFr: "Événements majeurs et tournois de basketball",
    icon: "🎪"
  },
  
  // Miscellaneous
  {
    id: "lifestyle",
    label: "Lifestyle",
    labelFr: "Style de vie",
    description: "Off-court lives, hobbies, and personal interests",
    descriptionFr: "Vie hors terrain, loisirs et intérêts personnels",
    parent: "misc",
    icon: "🌟"
  },
  {
    id: "charity",
    label: "Charity / Community",
    labelFr: "Charité / Communauté",
    description: "Community outreach and charitable activities",
    descriptionFr: "Sensibilisation communautaire et activités caritatives",
    parent: "misc",
    icon: "❤️"
  },
  {
    id: "misc",
    label: "Miscellaneous",
    labelFr: "Divers",
    description: "Other basketball-related content",
    descriptionFr: "Autre contenu lié au basketball",
    icon: "📦"
  },
];

// Helper functions
export function getParentCategories(): NewsCategory[] {
  return NEWS_CATEGORIES.filter(cat => !cat.parent);
}

export function getChildCategories(parentId: string): NewsCategory[] {
  return NEWS_CATEGORIES.filter(cat => cat.parent === parentId);
}

export function getCategoryById(id: string): NewsCategory | undefined {
  return NEWS_CATEGORIES.find(cat => cat.id === id);
}

export function searchCategories(query: string, language: 'en' | 'fr' = 'en'): NewsCategory[] {
  const lowerQuery = query.toLowerCase();
  return NEWS_CATEGORIES.filter(cat => {
    const label = (language === 'fr' ? cat.labelFr : cat.label).toLowerCase();
    const description = (language === 'fr' ? cat.descriptionFr : cat.description).toLowerCase();
    return label.includes(lowerQuery) || description.includes(lowerQuery);
  });
}
