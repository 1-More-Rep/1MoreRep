import path from 'node:path';

export const SUPERADMIN = { email: 'admin@1morerep.local', password: 'devsuperpass123' };
export const STORAGE_STATE = path.join(process.cwd(), 'tests/e2e/.auth/superadmin.json');
