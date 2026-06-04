# Create Half Court Image

You need to create a half-court image for the new All-Star voting format.

## Option 1: Crop the existing court.png
1. Open `public/court.png` in an image editor
2. Crop the image to show only the left half of the court
3. The new image should be approximately 470 × 500 pixels
4. Save as `public/court-half.png`

## Option 2: Use image editing command
If you have ImageMagick installed:
```bash
magick public/court.png -crop 50%x100% +repage public/court-half.png
```

## Option 3: Temporary fallback
For now, you can copy the full court and use it as a placeholder:
```powershell
Copy-Item public\court.png public\court-half.png
```

Then later replace it with a proper half-court image.

## What the image should show:
- Left half of the basketball court
- Center circle with LIPROBAKIN logo
- One three-point arc
- One free-throw area
- Court markings on the left side
- "ALL-STAR" text and stars (if visible on that half)
