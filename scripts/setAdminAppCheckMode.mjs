import fs from 'fs';
import path from 'path';

const modeArg = String(process.argv[2] || '').toLowerCase();
const normalizedMode = modeArg === 'true' || modeArg === 'on' || modeArg === 'enable'
  ? 'true'
  : modeArg === 'false' || modeArg === 'off' || modeArg === 'disable'
    ? 'false'
    : '';

if (!normalizedMode) {
  console.error('Usage: node scripts/setAdminAppCheckMode.mjs <true|false>');
  process.exit(1);
}

const envFilePath = path.resolve(process.cwd(), 'functions/.env.nurse-go-th');

if (!fs.existsSync(envFilePath)) {
  console.error(`Env file not found: ${envFilePath}`);
  process.exit(1);
}

const source = fs.readFileSync(envFilePath, 'utf8');

if (!source.includes('ENFORCE_ADMIN_APP_CHECK=')) {
  console.error('ENFORCE_ADMIN_APP_CHECK key not found in functions/.env.nurse-go-th');
  process.exit(1);
}

const updated = source.replace(/ENFORCE_ADMIN_APP_CHECK\s*=\s*(true|false)/, `ENFORCE_ADMIN_APP_CHECK=${normalizedMode}`);

if (updated === source) {
  console.log(`ENFORCE_ADMIN_APP_CHECK is already ${normalizedMode}`);
  process.exit(0);
}

fs.writeFileSync(envFilePath, updated);
console.log(`Set ENFORCE_ADMIN_APP_CHECK=${normalizedMode} in functions/.env.nurse-go-th`);
