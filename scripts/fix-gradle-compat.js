/**
 * fix-gradle-compat.js
 * Patches expo-firebase-core build.gradle for Gradle 8+ compatibility.
 * classifier = 'sources' was removed in Gradle 8 — replaced with archiveClassifier.set()
 * Run via postinstall: "postinstall": "node scripts/fix-gradle-compat.js"
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../node_modules/expo-firebase-core/android/build.gradle');

try {
  if (!fs.existsSync(FILE)) {
    console.log('[fix-gradle-compat] expo-firebase-core not found, skipping.');
    process.exit(0);
  }
  let content = fs.readFileSync(FILE, 'utf8');
  if (content.includes("classifier = 'sources'")) {
    content = content.replace("classifier = 'sources'", "archiveClassifier.set('sources')");
    fs.writeFileSync(FILE, content, 'utf8');
    console.log('[fix-gradle-compat] ✅ Patched expo-firebase-core/android/build.gradle');
  } else {
    console.log('[fix-gradle-compat] Already patched or not needed.');
  }
} catch (e) {
  console.error('[fix-gradle-compat] Error:', e.message);
  // Don't fail the build
}
