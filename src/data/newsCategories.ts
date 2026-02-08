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
  // ============================================
  // CORE NEWS CATEGORIES (Parent)
  // ============================================
  {
    id: "core-news",
    label: "Core News Categories",
    labelFr: "Catégories d'actualités principales",
    description: "Breaking news, game coverage, and essential updates",
    descriptionFr: "Nouvelles de dernière minute, couverture de jeux et mises à jour essentielles",
    icon: "📰"
  },
  
  // Core News Children
  {
    id: "headlines",
    label: "Headlines / Breaking News",
    labelFr: "Gros titres / Dernière minute",
    description: "Major announcements and urgent breaking stories",
    descriptionFr: "Annonces majeures et nouvelles urgentes",
    parent: "core-news",
    icon: "🔥"
  },
  {
    id: "transfers",
    label: "Transfers / Trades / Transactions",
    labelFr: "Transferts / Échanges / Transactions",
    description: "Player movements, trades, and roster changes",
    descriptionFr: "Mouvements de joueurs, échanges et changements d'effectif",
    parent: "core-news",
    icon: "🔄"
  },
  {
    id: "injuries",
    label: "Injuries & Health Updates",
    labelFr: "Blessures et santé",
    description: "Injury reports, recovery updates, and health status",
    descriptionFr: "Rapports de blessures, mises à jour de récupération",
    parent: "core-news",
    icon: "🏥"
  },
  {
    id: "rumors",
    label: "Rumors & Reports",
    labelFr: "Rumeurs et rapports",
    description: "Unconfirmed reports and insider speculation",
    descriptionFr: "Rapports non confirmés et spéculations",
    parent: "core-news",
    icon: "👂"
  },
  {
    id: "game-results",
    label: "Game Results / Recaps",
    labelFr: "Résultats / Résumés",
    description: "Post-game summaries and final scores",
    descriptionFr: "Résumés après-match et scores finaux",
    parent: "core-news",
    icon: "📊"
  },
  {
    id: "previews",
    label: "Previews / Matchups",
    labelFr: "Aperçus / Affrontements",
    description: "Upcoming game previews and matchup analysis",
    descriptionFr: "Aperçus de jeux à venir et analyses d'affrontements",
    parent: "core-news",
    icon: "🔮"
  },
  {
    id: "standings",
    label: "Standings / Rankings",
    labelFr: "Classements",
    description: "League standings and team rankings",
    descriptionFr: "Classements de ligue et positions des équipes",
    parent: "core-news",
    icon: "📈"
  },
  {
    id: "power-rankings",
    label: "Power Rankings",
    labelFr: "Classements de puissance",
    description: "Weekly power rankings and team assessments",
    descriptionFr: "Classements hebdomadaires et évaluations d'équipes",
    parent: "core-news",
    icon: "💪"
  },
  {
    id: "press-conferences",
    label: "Press Conferences / Quotes",
    labelFr: "Conférences de presse / Citations",
    description: "Coach and player statements and press conference highlights",
    descriptionFr: "Déclarations d'entraîneurs et joueurs",
    parent: "core-news",
    icon: "🎤"
  },

  // ============================================
  // PLAYER & TEAM FOCUS (Parent)
  // ============================================
  {
    id: "player-team-focus",
    label: "Player & Team Focus",
    labelFr: "Focus joueurs et équipes",
    description: "In-depth player and team features and stories",
    descriptionFr: "Reportages approfondis sur les joueurs et les équipes",
    icon: "⭐"
  },
  
  // Player & Team Focus Children
  {
    id: "player-spotlight",
    label: "Player Spotlight / Features",
    labelFr: "Vedette joueur / Reportages",
    description: "Featured player stories and spotlights",
    descriptionFr: "Histoires et reportages sur les joueurs vedettes",
    parent: "player-team-focus",
    icon: "🌟"
  },
  {
    id: "team-spotlight",
    label: "Team Spotlight / Features",
    labelFr: "Vedette équipe / Reportages",
    description: "Featured team stories and analysis",
    descriptionFr: "Histoires et analyses d'équipes vedettes",
    parent: "player-team-focus",
    icon: "🏀"
  },
  {
    id: "player-profiles",
    label: "Player Profiles / Bios",
    labelFr: "Profils de joueurs",
    description: "Detailed player biographies and profiles",
    descriptionFr: "Biographies et profils détaillés de joueurs",
    parent: "player-team-focus",
    icon: "📋"
  },
  {
    id: "rookie-watch",
    label: "Rookie Watch",
    labelFr: "Surveillance des recrues",
    description: "Rookie performance tracking and updates",
    descriptionFr: "Suivi des performances des recrues",
    parent: "player-team-focus",
    icon: "🆕"
  },
  {
    id: "veteran-stories",
    label: "Veteran Stories",
    labelFr: "Histoires de vétérans",
    description: "Veteran player stories and achievements",
    descriptionFr: "Histoires et réalisations de joueurs vétérans",
    parent: "player-team-focus",
    icon: "🎖️"
  },
  {
    id: "contract-extensions",
    label: "Contract Extensions",
    labelFr: "Extensions de contrat",
    description: "Contract extension news and negotiations",
    descriptionFr: "Nouvelles d'extensions de contrat et négociations",
    parent: "player-team-focus",
    icon: "📝"
  },
  {
    id: "retirements",
    label: "Retirements",
    labelFr: "Retraites",
    description: "Player retirement announcements and tributes",
    descriptionFr: "Annonces de retraite et hommages",
    parent: "player-team-focus",
    icon: "👋"
  },

  // ============================================
  // ANALYSIS & DEEP DIVES (Parent)
  // ============================================
  {
    id: "analysis",
    label: "Analysis & Deep Dives",
    labelFr: "Analyses approfondies",
    description: "Tactical breakdowns, stats, and expert analysis",
    descriptionFr: "Analyses tactiques, statistiques et analyses d'experts",
    icon: "🔍"
  },
  
  // Analysis Children
  {
    id: "film-breakdown",
    label: "Film Breakdown",
    labelFr: "Analyse vidéo",
    description: "Detailed game film analysis and breakdowns",
    descriptionFr: "Analyses détaillées de vidéos de jeu",
    parent: "analysis",
    icon: "🎬"
  },
  {
    id: "tactical-analysis",
    label: "Tactical Analysis",
    labelFr: "Analyse tactique",
    description: "Strategic and tactical game analysis",
    descriptionFr: "Analyses stratégiques et tactiques",
    parent: "analysis",
    icon: "♟️"
  },
  {
    id: "advanced-stats",
    label: "Advanced Stats / Analytics",
    labelFr: "Statistiques avancées",
    description: "Advanced statistics and data analytics",
    descriptionFr: "Statistiques avancées et analyses de données",
    parent: "analysis",
    icon: "📊"
  },
  {
    id: "playbook",
    label: "Playbook / Strategy",
    labelFr: "Livre de jeux / Stratégie",
    description: "Play designs, strategy breakdowns, and coaching insights",
    descriptionFr: "Conceptions de jeux, analyses stratégiques",
    parent: "analysis",
    icon: "📖"
  },
  {
    id: "opinion",
    label: "Opinion / Editorials",
    labelFr: "Opinion / Éditoriaux",
    description: "Expert opinions and editorial pieces",
    descriptionFr: "Opinions d'experts et articles éditoriaux",
    parent: "analysis",
    icon: "✍️"
  },
  {
    id: "scouting",
    label: "Scouting Reports",
    labelFr: "Rapports de dépistage",
    description: "Player and team scouting reports",
    descriptionFr: "Rapports de dépistage de joueurs et d'équipes",
    parent: "analysis",
    icon: "🔎"
  },

  // ============================================
  // MEDIA & HIGHLIGHTS (Parent)
  // ============================================
  {
    id: "media-highlights",
    label: "Media & Highlights",
    labelFr: "Médias et faits saillants",
    description: "Videos, highlights, and multimedia content",
    descriptionFr: "Vidéos, faits saillants et contenu multimédia",
    icon: "🎥"
  },
  
  // Media & Highlights Children
  {
    id: "highlights",
    label: "Highlights / Top Plays",
    labelFr: "Faits saillants / Meilleurs jeux",
    description: "Game highlights and top plays",
    descriptionFr: "Faits saillants de jeux et meilleurs jeux",
    parent: "media-highlights",
    icon: "⚡"
  },
  {
    id: "signature-plays",
    label: "Dunks / Blocks / Crossovers",
    labelFr: "Dunks / Blocs / Croisements",
    description: "Best dunks, blocks, and crossovers",
    descriptionFr: "Meilleurs dunks, blocs et croisements",
    parent: "media-highlights",
    icon: "💥"
  },
  {
    id: "full-game-highlights",
    label: "Full Game Highlights",
    labelFr: "Faits saillants complets",
    description: "Complete game highlight packages",
    descriptionFr: "Forfaits complets de faits saillants",
    parent: "media-highlights",
    icon: "📹"
  },
  {
    id: "interviews",
    label: "Interviews",
    labelFr: "Entrevues",
    description: "Player and coach interviews",
    descriptionFr: "Entrevues de joueurs et entraîneurs",
    parent: "media-highlights",
    icon: "🎙️"
  },
  {
    id: "micd-up",
    label: "Mic'd Up Moments",
    labelFr: "Moments avec micro",
    description: "Behind-the-scenes audio from players",
    descriptionFr: "Audio des coulisses avec les joueurs",
    parent: "media-highlights",
    icon: "🔊"
  },
  {
    id: "behind-scenes",
    label: "Behind the Scenes",
    labelFr: "Dans les coulisses",
    description: "Exclusive behind-the-scenes content",
    descriptionFr: "Contenu exclusif des coulisses",
    parent: "media-highlights",
    icon: "🎬"
  },

  // ============================================
  // LEAGUE & BUSINESS (Parent)
  // ============================================
  {
    id: "league-business",
    label: "League & Business",
    labelFr: "Ligue et affaires",
    description: "League operations, rules, and business news",
    descriptionFr: "Opérations de ligue, règles et nouvelles d'affaires",
    icon: "🏛️"
  },
  
  // League & Business Children
  {
    id: "league-announcements",
    label: "League Announcements",
    labelFr: "Annonces de ligue",
    description: "Official league announcements and updates",
    descriptionFr: "Annonces officielles de la ligue",
    parent: "league-business",
    icon: "📢"
  },
  {
    id: "rules-changes",
    label: "CBA / Rules Changes",
    labelFr: "CBA / Changements de règles",
    description: "Collective bargaining and rule changes",
    descriptionFr: "Négociations collectives et changements de règles",
    parent: "league-business",
    icon: "📜"
  },
  {
    id: "salary-cap",
    label: "Salary Cap News",
    labelFr: "Nouvelles du plafond salarial",
    description: "Salary cap updates and financial news",
    descriptionFr: "Mises à jour du plafond salarial",
    parent: "league-business",
    icon: "💰"
  },
  {
    id: "front-office",
    label: "Ownership / Front Office Moves",
    labelFr: "Propriété / Mouvements administratifs",
    description: "Front office changes and ownership news",
    descriptionFr: "Changements administratifs et nouvelles de propriété",
    parent: "league-business",
    icon: "🏢"
  },
  {
    id: "coaching-changes",
    label: "Coaching Changes",
    labelFr: "Changements d'entraîneurs",
    description: "Coaching hires, fires, and changes",
    descriptionFr: "Embauches, licenciements et changements d'entraîneurs",
    parent: "league-business",
    icon: "👔"
  },
  {
    id: "referee-reports",
    label: "Referee Reports",
    labelFr: "Rapports d'arbitrage",
    description: "Officiating reports and referee news",
    descriptionFr: "Rapports d'arbitrage et nouvelles des arbitres",
    parent: "league-business",
    icon: "👨‍⚖️"
  },

  // ============================================
  // FAN ENGAGEMENT (Parent)
  // ============================================
  {
    id: "fan-engagement",
    label: "Fan Engagement",
    labelFr: "Engagement des fans",
    description: "Fan content, polls, fantasy, and community",
    descriptionFr: "Contenu pour fans, sondages, fantasy et communauté",
    icon: "🙌"
  },
  
  // Fan Engagement Children
  {
    id: "fan-zone",
    label: "Fan Zone",
    labelFr: "Zone des fans",
    description: "Fan content, reactions, and community",
    descriptionFr: "Contenu des fans, réactions et communauté",
    parent: "fan-engagement",
    icon: "🎉"
  },
  {
    id: "polls-debates",
    label: "Polls & Debates",
    labelFr: "Sondages et débats",
    description: "Fan polls, debates, and discussions",
    descriptionFr: "Sondages, débats et discussions des fans",
    parent: "fan-engagement",
    icon: "🗳️"
  },
  {
    id: "social-buzz",
    label: "Memes & Social Media Buzz",
    labelFr: "Mèmes et buzz social",
    description: "Trending memes and social media moments",
    descriptionFr: "Mèmes tendance et moments des médias sociaux",
    parent: "fan-engagement",
    icon: "😂"
  },
  {
    id: "community",
    label: "Community Stories",
    labelFr: "Histoires de communauté",
    description: "Community events and local stories",
    descriptionFr: "Événements communautaires et histoires locales",
    parent: "fan-engagement",
    icon: "🤝"
  },
  {
    id: "fantasy",
    label: "Fantasy Basketball",
    labelFr: "Basketball fantastique",
    description: "Fantasy basketball tips and updates",
    descriptionFr: "Conseils et mises à jour de basketball fantastique",
    parent: "fan-engagement",
    icon: "🎮"
  },
  {
    id: "betting",
    label: "Betting / Odds / Predictions",
    labelFr: "Paris / Cotes / Prédictions",
    description: "Betting odds, predictions, and analysis",
    descriptionFr: "Cotes de paris, prédictions et analyses",
    parent: "fan-engagement",
    icon: "🎲"
  },

  // ============================================
  // HISTORY & CULTURE (Parent)
  // ============================================
  {
    id: "history-culture",
    label: "History & Culture",
    labelFr: "Histoire et culture",
    description: "Basketball history, legends, and cultural moments",
    descriptionFr: "Histoire du basketball, légendes et moments culturels",
    icon: "📚"
  },
  
  // History & Culture Children
  {
    id: "throwback",
    label: "Throwback / History",
    labelFr: "Retour en arrière / Histoire",
    description: "Historical moments and throwback content",
    descriptionFr: "Moments historiques et contenu rétro",
    parent: "history-culture",
    icon: "⏮️"
  },
  {
    id: "legends",
    label: "Legends & Hall of Fame",
    labelFr: "Légendes et temple de la renommée",
    description: "Legendary players and Hall of Fame inductees",
    descriptionFr: "Joueurs légendaires et intronisés au temple",
    parent: "history-culture",
    icon: "🏆"
  },
  {
    id: "anniversaries",
    label: "Anniversaries",
    labelFr: "Anniversaires",
    description: "Historical anniversaries and milestones",
    descriptionFr: "Anniversaires historiques et jalons",
    parent: "history-culture",
    icon: "🎂"
  },
  {
    id: "classic-games",
    label: "Classic Games",
    labelFr: "Jeux classiques",
    description: "Iconic and memorable games from the past",
    descriptionFr: "Jeux emblématiques et mémorables du passé",
    parent: "history-culture",
    icon: "📼"
  },
  {
    id: "basketball-culture",
    label: "Basketball Culture",
    labelFr: "Culture du basketball",
    description: "Cultural impact and lifestyle content",
    descriptionFr: "Impact culturel et contenu lifestyle",
    parent: "history-culture",
    icon: "🎨"
  },
  {
    id: "sneakers",
    label: "Sneakers / Gear",
    labelFr: "Chaussures / Équipement",
    description: "Sneaker releases, gear, and equipment news",
    descriptionFr: "Sorties de chaussures, équipement et matériel",
    parent: "history-culture",
    icon: "👟"
  },

  // ============================================
  // YOUTH & DEVELOPMENT (Parent)
  // ============================================
  {
    id: "youth-development",
    label: "Youth & Development",
    labelFr: "Jeunesse et développement",
    description: "Youth basketball, prospects, and development leagues",
    descriptionFr: "Basketball jeunesse, espoirs et ligues de développement",
    icon: "🌱"
  },
  
  // Youth & Development Children
  {
    id: "high-school",
    label: "High School Basketball",
    labelFr: "Basketball secondaire",
    description: "High school basketball coverage",
    descriptionFr: "Couverture du basketball secondaire",
    parent: "youth-development",
    icon: "🎓"
  },
  {
    id: "aau",
    label: "AAU / Travel Ball",
    labelFr: "AAU / Ligues voyages",
    description: "AAU and travel basketball coverage",
    descriptionFr: "Couverture AAU et basketball de voyage",
    parent: "youth-development",
    icon: "✈️"
  },
  {
    id: "college",
    label: "College Basketball",
    labelFr: "Basketball universitaire",
    description: "College basketball news and updates",
    descriptionFr: "Nouvelles et mises à jour du basketball universitaire",
    parent: "youth-development",
    icon: "🎓"
  },
  {
    id: "draft-prospects",
    label: "Draft Prospects",
    labelFr: "Espoirs du repêchage",
    description: "Draft prospect evaluations and rankings",
    descriptionFr: "Évaluations et classements des espoirs",
    parent: "youth-development",
    icon: "🔝"
  },
  {
    id: "international-prospects",
    label: "International Prospects",
    labelFr: "Espoirs internationaux",
    description: "International player prospects and scouting",
    descriptionFr: "Espoirs internationaux et dépistage",
    parent: "youth-development",
    icon: "🌍"
  },
  {
    id: "development-leagues",
    label: "Development Leagues",
    labelFr: "Ligues de développement",
    description: "G League and other development league coverage",
    descriptionFr: "Couverture de G League et autres ligues",
    parent: "youth-development",
    icon: "🏀"
  },

  // ============================================
  // EVENTS & SPECIAL COVERAGE (Parent)
  // ============================================
  {
    id: "events",
    label: "Events & Special Coverage",
    labelFr: "Événements et couverture spéciale",
    description: "Major events and special coverage throughout the season",
    descriptionFr: "Événements majeurs et couverture spéciale de la saison",
    icon: "🎊"
  },
  
  // Events Children
  {
    id: "all-star",
    label: "All-Star Weekend",
    labelFr: "Fin de semaine des étoiles",
    description: "All-Star Weekend coverage and highlights",
    descriptionFr: "Couverture de la fin de semaine des étoiles",
    parent: "events",
    icon: "⭐"
  },
  {
    id: "playoffs",
    label: "Playoffs",
    labelFr: "Éliminatoires",
    description: "Playoff coverage, previews, and analysis",
    descriptionFr: "Couverture, aperçus et analyses des éliminatoires",
    parent: "events",
    icon: "🏀"
  },
  {
    id: "finals",
    label: "Finals",
    labelFr: "Finales",
    description: "Championship finals coverage",
    descriptionFr: "Couverture des finales de championnat",
    parent: "events",
    icon: "🏆"
  },
  {
    id: "draft-night",
    label: "Draft Night",
    labelFr: "Soirée du repêchage",
    description: "Draft night coverage and analysis",
    descriptionFr: "Couverture et analyse de la soirée du repêchage",
    parent: "events",
    icon: "📋"
  },
  {
    id: "summer-league",
    label: "Summer League",
    labelFr: "Ligue d'été",
    description: "Summer league games and player development",
    descriptionFr: "Jeux de ligue d'été et développement des joueurs",
    parent: "events",
    icon: "☀️"
  },
  {
    id: "training-camp",
    label: "Training Camp",
    labelFr: "Camp d'entraînement",
    description: "Training camp updates and roster battles",
    descriptionFr: "Mises à jour du camp et batailles de roster",
    parent: "events",
    icon: "🏋️"
  },
  {
    id: "media-day",
    label: "Media Day",
    labelFr: "Journée médias",
    description: "Media day coverage and team previews",
    descriptionFr: "Couverture de la journée médias et aperçus d'équipes",
    parent: "events",
    icon: "📸"
  }
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
    const label = language === 'fr' ? cat.labelFr : cat.label;
    const description = language === 'fr' ? cat.descriptionFr : cat.description;
    return label.toLowerCase().includes(lowerQuery) || 
           description.toLowerCase().includes(lowerQuery);
  });
}
