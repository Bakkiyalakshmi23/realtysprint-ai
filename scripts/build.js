'use strict';

const fs = require('fs');
const path = require('path');

console.log('==========================================');
console.log('🏗️  RealtySprint AI — Frontend Build Script');
console.log('==========================================');

const rawBackendUrl = (process.env.BACKEND_API_URL || '').trim();

if (!rawBackendUrl) {
  console.error('\n[build] ❌ ERROR: BACKEND_API_URL environment variable is required for production build.');
  console.error('[build] You must configure BACKEND_API_URL in your hosting platform dashboard (e.g. Vercel Project Settings > Environment Variables).');
  console.error('[build] Example: BACKEND_API_URL=https://<your-verified-backend-service>\n');
  process.exit(1);
}

// Validate URL structure
let validatedUrl;
try {
  const parsed = new URL(rawBackendUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL protocol must be http: or https:');
  }
  // Strip trailing slashes to avoid double-slashes in API endpoints
  validatedUrl = rawBackendUrl.replace(/\/+$/, '');
} catch (err) {
  console.error(`\n[build] ❌ ERROR: Invalid BACKEND_API_URL provided: "${rawBackendUrl}"`);
  console.error(`[build] Details: ${err.message}\n`);
  process.exit(1);
}

console.log(`[build] Target Backend API URL: ${validatedUrl}`);

const frontendDir = path.join(__dirname, '../frontend');
const appApiPath = path.join(frontendDir, 'app/api.js');
const authPath = path.join(frontendDir, 'auth.js');
const rootIndexPath = path.join(__dirname, '../index.html');
const frontendIndexPath = path.join(frontendDir, 'index.html');

/**
 * Idempotently updates the API_BASE_URL constant in a frontend JS file.
 */
function updateApiBaseUrl(filePath, newUrl) {
  if (!fs.existsSync(filePath)) {
    console.error(`[build] ❌ ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const regex = /(const API_BASE_URL = isLocal \? 'http:\/\/localhost:4000' : )(['"][^'"]*['"])(;)/;

  if (regex.test(content)) {
    content = content.replace(regex, `$1"${newUrl}"$3`);
  } else if (content.includes('___API_BASE_URL___')) {
    content = content.replace(/['"]___API_BASE_URL___['"]/g, `"${newUrl}"`);
  } else {
    console.warn(`[build] ⚠️  Warning: Could not find API_BASE_URL definition pattern in ${path.basename(filePath)}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[build] ✓ Configured API_BASE_URL in: ${path.relative(path.join(__dirname, '..'), filePath)}`);
}

// 1. Update API client and Auth modules
updateApiBaseUrl(appApiPath, validatedUrl);
updateApiBaseUrl(authPath, validatedUrl);


// 3. Verify all required static frontend assets exist
const requiredAssets = [
  'index.html',
  'login.html',
  'styles.css',
  'auth.js',
  'app/index.html',
  'app/api.js',
  'app/app.js',
  'app/styles.css',
  'app/tasks.html',
  'app/leads.html',
  'app/agents.html',
  'app/approvals.html',
  'app/activity.html',
  'app/settings.html',
  'app/clients.html',
  'app/client.html',
];

let missingCount = 0;
for (const relPath of requiredAssets) {
  const fullPath = path.join(frontendDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[build] ❌ Missing expected asset: frontend/${relPath}`);
    missingCount++;
  }
}

if (missingCount > 0) {
  console.error(`\n[build] ❌ Build failed: ${missingCount} required asset(s) missing.\n`);
  process.exit(1);
}

console.log(`[build] ✓ Verified all ${requiredAssets.length} frontend assets are present.`);
console.log('==========================================');
console.log('✅ Build completed successfully.');
console.log('==========================================\n');
