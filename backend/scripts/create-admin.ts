/**
 * Create Admin User
 * Script to create an admin user for testing multi-level auth
 */

import { hashPassword } from '../src/auth';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'super_admin';
  tenantId: string;
  createdAt: string;
}

async function createAdmin() {
  // Hardcoded test credentials
  const email = 'admin@framevideos.com';
  const password = 'Admin123!';
  const tenantId = '00000000-0000-0000-0000-000000000000'; // System tenant
  
  const passwordHash = await hashPassword(password);
  
  const admin: User = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    role: 'admin',
    tenantId,
    createdAt: new Date().toISOString(),
  };

  console.log('='.repeat(60));
  console.log('ADMIN USER CREATED');
  console.log('='.repeat(60));
  console.log('');
  console.log('Execute this SQL in your D1 database:');
  console.log('');
  console.log('```sql');
  console.log(`INSERT INTO users (id, email, password_hash, role, tenant_id, created_at)`);
  console.log(`VALUES (`);
  console.log(`  '${admin.id}',`);
  console.log(`  '${admin.email}',`);
  console.log(`  '${admin.passwordHash}',`);
  console.log(`  '${admin.role}',`);
  console.log(`  '${admin.tenantId}',`);
  console.log(`  '${admin.createdAt}'`);
  console.log(`);`);
  console.log('```');
  console.log('');
  console.log('Credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('='.repeat(60));
}

createAdmin().catch(console.error);
