const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const TRUSTED_MEDIA_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

const DRY_RUN = !process.argv.includes('--apply');

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ppop-35930';
  const localServiceAccountPath = path.join(__dirname, '..', 'ppop-35930-firebase-adminsdk-tbv5s-e2d4729b21.json');

  if (fs.existsSync(localServiceAccountPath)) {
    const serviceAccount = require(localServiceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
}

const db = admin.firestore();

function isTrustedMediaUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return TRUSTED_MEDIA_HOSTS.some((host) => parsed.hostname.includes(host));
  } catch {
    return false;
  }
}

function sanitizeArticleMedia(data) {
  const currentImage = typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '';
  const currentVideo = typeof data.videoUrl === 'string' ? data.videoUrl.trim() : '';
  const currentAdditional = Array.isArray(data.additionalImageUrls)
    ? data.additionalImageUrls.filter((item) => typeof item === 'string')
    : [];

  const nextImage = isTrustedMediaUrl(currentImage) ? currentImage : null;
  const nextVideo = isTrustedMediaUrl(currentVideo) ? currentVideo : null;
  const nextAdditional = currentAdditional
    .map((url) => url.trim())
    .filter((url) => isTrustedMediaUrl(url));

  const imageChanged = (currentImage || null) !== nextImage;
  const videoChanged = (currentVideo || null) !== nextVideo;
  const additionalChanged = JSON.stringify(currentAdditional) !== JSON.stringify(nextAdditional);

  return {
    changed: imageChanged || videoChanged || additionalChanged,
    update: {
      imageUrl: nextImage,
      videoUrl: nextVideo,
      additionalImageUrls: nextAdditional.length ? nextAdditional : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    removed: {
      imageRemoved: imageChanged && nextImage === null,
      videoRemoved: videoChanged && nextVideo === null,
      additionalRemovedCount: Math.max(currentAdditional.length - nextAdditional.length, 0),
    },
  };
}

async function run() {
  console.log(`🚀 Starting news media cleanup (${DRY_RUN ? 'DRY RUN' : 'APPLY'})...`);

  const snapshot = await db.collection('news').get();
  console.log(`📰 Found ${snapshot.size} articles.`);

  let changedCount = 0;
  let imageRemovedTotal = 0;
  let videoRemovedTotal = 0;
  let additionalRemovedTotal = 0;
  const changedDocs = [];

  const batch = db.batch();
  let batchOps = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const result = sanitizeArticleMedia(data);

    if (!result.changed) continue;

    changedCount += 1;
    imageRemovedTotal += result.removed.imageRemoved ? 1 : 0;
    videoRemovedTotal += result.removed.videoRemoved ? 1 : 0;
    additionalRemovedTotal += result.removed.additionalRemovedCount;

    changedDocs.push({
      id: docSnap.id,
      title: data.title || '(untitled)',
      ...result.removed,
    });

    if (!DRY_RUN) {
      batch.update(docSnap.ref, result.update);
      batchOps += 1;

      if (batchOps >= 450) {
        await batch.commit();
        batchOps = 0;
      }
    }
  }

  if (!DRY_RUN && batchOps > 0) {
    await batch.commit();
  }

  console.log('\n📊 Cleanup summary:');
  console.log(`- Articles changed: ${changedCount}`);
  console.log(`- Cover images removed: ${imageRemovedTotal}`);
  console.log(`- Cover videos removed: ${videoRemovedTotal}`);
  console.log(`- Additional images removed: ${additionalRemovedTotal}`);

  if (changedDocs.length > 0) {
    console.log('\n🧾 Changed articles:');
    changedDocs.forEach((item) => {
      console.log(
        `- ${item.id} | ${item.title} | imageRemoved=${item.imageRemoved} videoRemoved=${item.videoRemoved} additionalRemoved=${item.additionalRemovedCount}`
      );
    });
  }

  if (DRY_RUN) {
    console.log('\n✅ Dry run complete.');
    console.log('Run with --apply to write updates:');
    console.log('node scripts/cleanup-news-media-urls.js --apply');
  } else {
    console.log('\n✅ Cleanup applied successfully.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
