const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

try {
  execSync('npx prisma db push', { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}
