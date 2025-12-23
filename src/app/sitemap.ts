import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://liprobakin.com'
  
  // Static pages
  const routes = [
    '',
    '/account',
    '/admin',
    '/profile-setup',
    '/verification-pending',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Team pages
  const teams = [
    'Viperes-Kinshasa', 'Baninga-Basanga', 'Lionne-Katanga', 'Gazelle-Equateur',
    'Lionceaux-Kinshasa', 'Donga-Kasai', 'Panthere-Bas-Uele', 'Mangbetu-Haut-Uele',
    'Coq-Kongo-Central'
  ]
  
  const teamRoutes = teams.map((team) => ({
    url: `${baseUrl}/team/${team}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  return [...routes, ...teamRoutes]
}
