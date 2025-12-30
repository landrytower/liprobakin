# Google AdSense Setup Guide

Google Ads have been integrated into your Liprobakin website. Follow these steps to complete the setup and start earning revenue.

## ✅ What's Been Added

1. **GoogleAd Component** (`src/components/GoogleAd.tsx`)
   - Reusable component for displaying ads throughout the site

2. **AdSense Script** (in `src/app/layout.tsx`)
   - Global AdSense script loaded on every page

3. **Ad Placements:**
   - **Homepage** (`src/app/page.tsx`):
     - Top banner ad (after header, before stats section)
     - In-feed ad (between stats and standings)
     - Content ad (before teams section)
   
   - **Player Pages** (`src/app/player/[teamName]/[playerNumber]/page.tsx`):
     - Sidebar ad (after player hero section)
     - Content ad (before stats section)

## 📋 Steps to Complete

### 1. Sign Up for Google AdSense

1. Go to: https://www.google.com/adsense
2. Click **"Get Started"**
3. Sign in with your Google account
4. Fill in your website details:
   - Website URL: `https://liprobakin.com`
   - Content language: Select your primary language
5. Submit your application

⏳ **Approval Time:** Usually 1-3 days (can take up to 2 weeks)

### 2. Get Your Publisher ID

Once approved, you'll receive:
- **Publisher ID**: Format `ca-pub-XXXXXXXXXXXXXXX` (16 digits)

### 3. Update Your Code

Replace the placeholder IDs with your actual AdSense IDs:

#### A. Update Layout (Global Script)
File: `src/app/layout.tsx`

Find this line (around line 118):
```tsx
src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXX"
```

Replace `ca-pub-XXXXXXXXXXXXX` with your actual Publisher ID

#### B. Update GoogleAd Component
File: `src/components/GoogleAd.tsx`

Find this line (around line 35):
```tsx
data-ad-client="ca-pub-XXXXXXXXXXXXX"
```

Replace `ca-pub-XXXXXXXXXXXXX` with your actual Publisher ID

### 4. Create Ad Units in AdSense Dashboard

After approval, create ad units for each placement:

1. In AdSense dashboard, go to **Ads → By ad unit → Display ads**
2. Create the following ad units:

   **Homepage Ads:**
   - **Top Banner** → Get Ad Unit ID (slot)
   - **In-Feed Ad** → Get Ad Unit ID (slot)
   - **Content Ad** → Get Ad Unit ID (slot)
   
   **Player Page Ads:**
   - **Sidebar Ad** → Get Ad Unit ID (slot)
   - **Content Ad** → Get Ad Unit ID (slot)

### 5. Update Slot IDs

Replace placeholder slot IDs in your code:

#### Homepage (`src/app/page.tsx`)
```tsx
// Top Banner (line ~2985)
slot="1234567890"  → slot="YOUR_TOP_BANNER_SLOT_ID"

// In-Feed Ad (line ~3399)
slot="2345678901"  → slot="YOUR_IN_FEED_SLOT_ID"

// Content Ad (line ~3468)
slot="3456789012"  → slot="YOUR_CONTENT_SLOT_ID"
```

#### Player Pages (`src/app/player/[teamName]/[playerNumber]/page.tsx`)
```tsx
// Sidebar Ad (line ~495)
slot="4567890123"  → slot="YOUR_PLAYER_SIDEBAR_SLOT_ID"

// Content Ad (line ~630)
slot="5678901234"  → slot="YOUR_PLAYER_CONTENT_SLOT_ID"
```

## 🚀 Deploy Changes

After updating all IDs:

```bash
# Commit changes
git add .
git commit -m "Configure Google AdSense with actual IDs"
git push origin master

# Deploy to Vercel (automatic on push, or manually)
vercel --prod
```

## 📊 Ad Performance

### Best Performing Ad Locations
1. **Top Banner** - High visibility, first thing users see
2. **In-Feed Ads** - Natural placement between content
3. **Sidebar Ads** - Good for long-form content pages

### Optimization Tips
- Wait 24-48 hours after deployment for ads to appear
- Don't click your own ads (violates AdSense policy)
- Monitor performance in AdSense dashboard
- Experiment with different ad formats if needed

## ⚠️ Important Notes

### AdSense Policies
- ✅ **DO:** Place ads naturally within content
- ✅ **DO:** Ensure content is high-quality and original
- ❌ **DON'T:** Click your own ads
- ❌ **DON'T:** Encourage others to click ads
- ❌ **DON'T:** Use more than 3 ads per page

### Auto Ads (Optional)
Google offers "Auto Ads" that automatically place ads. If you enable this:
1. Go to AdSense → Ads → Auto ads
2. Toggle on for your site
3. You can remove manual ad placements or keep both

### Troubleshooting

**Ads not showing?**
- Check browser console (F12) for errors
- Verify Publisher ID is correct
- Wait 24-48 hours after deployment
- Check if ad blocker is enabled (disable for testing)
- Ensure slot IDs match your AdSense dashboard

**Blank spaces instead of ads?**
- Ad inventory might be low (normal, especially for new sites)
- Try different ad formats
- Ensure your site has sufficient content

## 💰 Revenue Tracking

Track your earnings in the AdSense dashboard:
1. Go to: https://adsense.google.com
2. Navigate to **Reports**
3. View metrics:
   - Impressions (how many times ads were shown)
   - Clicks (how many times ads were clicked)
   - RPM (Revenue per 1000 impressions)
   - Estimated earnings

## 📝 Current Ad Placements

| Page | Location | Slot Placeholder | Format |
|------|----------|------------------|--------|
| Homepage | Top Banner | 1234567890 | Horizontal |
| Homepage | In-Feed | 2345678901 | Auto |
| Homepage | Content | 3456789012 | Auto |
| Player Pages | Sidebar | 4567890123 | Vertical |
| Player Pages | Content | 5678901234 | Auto |

## 🔧 Need More Ads?

To add ads to other pages (teams, games, news):

1. Import the component:
```tsx
import GoogleAd from '@/components/GoogleAd';
```

2. Add the component:
```tsx
<GoogleAd 
  slot="YOUR_SLOT_ID"
  format="auto"
  className="my-8"
/>
```

3. Create corresponding ad unit in AdSense dashboard

---

**Need Help?**
- AdSense Help: https://support.google.com/adsense
- AdSense Community: https://support.google.com/adsense/community
