import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/setup-admin/', '/verification-pending/'],
    },
    sitemap: 'https://liprobakin.com/sitemap.xml',
  }
}
