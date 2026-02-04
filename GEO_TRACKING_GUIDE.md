# Geographic Analytics Troubleshooting & Setup Guide

## Current Status

Your geolocation tracking **IS implemented** in the code but you may not be seeing data because:

1. **Docker/Grafana is not running** - You need to start the observability stack to visualize the data
2. **Low traffic** - Geo data is only collected on pageviews
3. **Local testing limitations** - Local IPs (127.0.0.1) don't have geographic data

## How Geolocation Works

### Data Collection
When users visit your site, the analytics system:
1. Captures their IP address from request headers
2. Looks up the country using `ipapi.co` API
3. Stores it in `pageViewsByCountry` metrics
4. Exposes it via Prometheus metrics endpoint

### Code Location
- **Analytics endpoint**: `src/app/api/analytics/route.ts`
  - Function `getClientIp()` extracts IP (lines 91-106)
  - Function `lookupCountry()` does geo lookup (lines 108-132)
  - Country is tracked on pageview events (line 167)

- **Prometheus metrics**: `src/app/api/analytics/route.ts` (lines 251-253)
  ```typescript
  liprobakin_pageviews_country_total{country="CD"} 42
  liprobakin_pageviews_country_total{country="US"} 15
  ```

## Testing Geolocation

### 1. Test IP Detection
Visit this URL when your dev server is running:
```
http://localhost:3000/api/geo-test
```

This will show:
- Your detected IP address
- Country, city, region
- All available headers

### 2. View Raw Metrics
```
http://localhost:3000/api/analytics
```

Look for lines like:
```
liprobakin_pageviews_country_total{country="US"} 5
```

### 3. View in Grafana

Once Docker is running:

**Start the observability stack:**
```powershell
docker-compose up -d
```

**Access Grafana:**
```
http://localhost:3001
Username: admin
Password: admin
```

**Navigate to:**
- Dashboards → User Behavior Dashboard
- Look for "🌍 Pageviews by country" panel (geomap visualization)

## Deployment Considerations

### On Vercel (Production)
Vercel provides geo headers automatically:
- `x-vercel-ip-country` - Country code (e.g., "US")
- `x-vercel-ip-city` - City name
- `x-vercel-ip-country-region` - Region/state

The code already handles these (line 92 in route.ts):
```typescript
const vercelCountry = req.headers.get('x-vercel-ip-country');
if (vercelCountry) return `vercel-${vercelCountry}`;
```

### On Other Platforms
The code falls back to:
1. `x-forwarded-for` header
2. `cf-connecting-ip` (Cloudflare)
3. `x-real-ip` header
4. Direct IP from request

Then uses `ipapi.co` to look up geographic data.

## Common Issues

### Issue 1: "Unknown" Country
**Cause**: 
- Local development (127.0.0.1 or localhost IPs)
- API lookup failed
- Headers not present

**Solution**:
- Deploy to Vercel/production to get real visitor IPs
- Use a VPN or mobile device to test from different locations
- Check console logs for lookup errors

### Issue 2: No Data in Grafana
**Cause**:
- Docker not running
- Prometheus not scraping
- No visitors yet

**Solution**:
```powershell
# 1. Start all services
docker-compose up -d

# 2. Check Prometheus is scraping
# Visit: http://localhost:9090/targets
# Verify 'liprobakin-local' or 'liprobakin-production' shows as UP

# 3. Generate some traffic
# Visit your site multiple times from different pages

# 4. Wait 30s for Prometheus to scrape
# Then check Grafana dashboard
```

### Issue 3: Rate Limiting
**Cause**: ipapi.co has rate limits (1000 requests/day free tier)

**Solution**:
- Code already caches results (geoCache, 1 hour TTL)
- For high traffic, use Vercel's geo headers (already implemented)
- Or upgrade to a paid geo API service

## Verification Steps

### Step 1: Check if Analytics is Working
```powershell
# In your project directory
# Start dev server if not running
npm run dev

# In another terminal, make a test request
Invoke-WebRequest -Uri "http://localhost:3000/api/geo-test" | Select-Object -Expand Content
```

Expected output:
```json
{
  "ip": "YOUR_IP",
  "country": "YOUR_COUNTRY",
  "city": "YOUR_CITY",
  "region": "YOUR_REGION"
}
```

### Step 2: Generate Pageviews
```powershell
# Visit your site
Start-Process "http://localhost:3000"

# Check metrics
Start-Process "http://localhost:3000/api/analytics"
```

Look for `liprobakin_pageviews_country_total` entries.

### Step 3: Start Grafana
```powershell
# Wait for Docker Desktop to fully start (check system tray)
docker ps

# Start observability stack
docker-compose up -d

# Wait 30-60 seconds for containers to start
Start-Sleep -Seconds 30

# Open Grafana
Start-Process "http://localhost:3001"
```

## Grafana Dashboard Setup

1. **Login** (admin/admin)
2. **Navigate**: Dashboards → User Behavior Dashboard
3. **Find Geo Panel**: Scroll to "🌍 Pageviews by country"
4. **Verify Data**: Should show a world map with colored regions

## Improving Geo Tracking

### Add More Geo Details
To track city/region in addition to country, modify `src/app/api/analytics/route.ts`:

```typescript
// Around line 110, enhance lookupCountry function:
async function lookupGeoData(ip: string): Promise<{ country: string; city: string; region: string }> {
  // ... existing cache logic ...
  
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (res.ok) {
      const data = await res.json();
      return {
        country: data.country_name || 'unknown',
        city: data.city || 'unknown',
        region: data.region || 'unknown'
      };
    }
  } catch (error) {
    console.error('Geo lookup failed', error);
  }
  
  return { country: 'unknown', city: 'unknown', region: 'unknown' };
}
```

### Add Real-Time Monitoring
Consider setting up alerts in Grafana:
- Traffic from new countries
- Unusual geographic patterns
- Traffic spikes from specific regions

## Quick Start Commands

```powershell
# 1. Ensure Docker Desktop is running
# Check system tray for Docker icon

# 2. Start observability stack
cd c:\Users\bobiy\OneDrive\Documents\Bio\febakin
docker-compose up -d

# 3. Verify services
docker ps

# 4. Check Prometheus targets
Start-Process "http://localhost:9090/targets"

# 5. Open Grafana
Start-Process "http://localhost:3001"

# 6. Generate test traffic
Start-Process "http://localhost:3000"
```

## Support

If issues persist:
1. Check Docker Desktop is fully started
2. Run `docker-compose logs grafana` to see errors
3. Verify Prometheus is scraping: http://localhost:9090/targets
4. Check analytics metrics: http://localhost:3000/api/analytics
