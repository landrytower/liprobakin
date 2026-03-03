import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get client IP from various headers
  const vercelCountry = request.headers.get('x-vercel-ip-country');
  const vercelCity = request.headers.get('x-vercel-ip-city');
  const vercelRegion = request.headers.get('x-vercel-ip-country-region');
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const firstIp = forwarded.split(',')[0]?.trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  const realIp = request.headers.get('x-real-ip');
  const nextIp = (request as unknown as { ip?: string }).ip;

  let country = 'Unknown';
  let city = 'Unknown';
  let region = 'Unknown';
  const ip = firstIp || cfIp || realIp || nextIp || 'Unknown';

  // If on Vercel, use their geo headers
  if (vercelCountry) {
    country = vercelCountry;
    city = vercelCity || 'Unknown';
    region = vercelRegion || 'Unknown';
  } else if (ip && ip !== 'Unknown') {
    // Try to lookup IP using ipapi.co
    try {
      const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
      if (response.ok) {
        const data = await response.json();
        country = data.country_name || data.country || 'Unknown';
        city = data.city || 'Unknown';
        region = data.region || 'Unknown';
      }
    } catch (error) {
      console.error('IP lookup failed:', error);
    }
  }

  return NextResponse.json({
    ip,
    country,
    city,
    region,
    headers: {
      'x-vercel-ip-country': vercelCountry,
      'x-vercel-ip-city': vercelCity,
      'x-vercel-ip-country-region': vercelRegion,
      'x-forwarded-for': forwarded,
      'cf-connecting-ip': cfIp,
      'x-real-ip': realIp,
    },
    timestamp: new Date().toISOString(),
  });
}
