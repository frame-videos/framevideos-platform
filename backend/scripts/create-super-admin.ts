/**
 * Create Super Admin User
 * Script to create a super_admin user for testing multi-level auth
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

async function createSuperAdmin() {
  // Hardcoded test credentials
  const email = 'super@framevideos.com';
  const password = 'SuperAdmin123!';
  const tenantId = '00000000-0000-0000-0000-000000000000'; // System tenant
  
  const passwordHash = await hashPassword(password);
  
  const superAdmin: User = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    role: 'super_admin',
    tenantId,
    createdAt: new Date().toISOString(),
  };

  console.log('='.repeat(60));
  console.log('SUPER ADMIN USER CREATED');
  console.log('='.repeat(60));
  console.log('');
  console.log('Execute this SQL in your D1 database:');
  console.log('');
  console.log('```sql');
  console.log(`INSERT INTO users (id, email, password_hash, role, tenant_id, created_at)`);
  console.log(`VALUES (`);
  console.log(`  '${superAdmin.id}',`);
  console.log(`  '${superAdmin.email}',`);
  console.log(`  '${superAdmin.passwordHash}',`);
  console.log(`  '${superAdmin.role}',`);
  console.log(`  '${superAdmin.tenantId}',`);
  console.log(`  '${superAdmin.createdAt}'`);
  console.log(`);`);
  console.log('```');
  console.log('');
  console.log('Credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('='.repeat(60));
}

createSuperAdmin().catch(console.error);
