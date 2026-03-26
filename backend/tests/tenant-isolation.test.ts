/**
 * Tenant Isolation Tests
 * Validates that Tenant A cannot access Tenant B's data
 */

import { secureDb } from '../src/database-secure';
import { User, Tenant, Video } from '../src/database';
import { generateToken } from '../src/auth';

// Test utilities
async function setupTestTenants() {
  const tenantA: Tenant = {
    id: 'tenant-a-id',
    name: 'Tenant A',
    domain: 'tenant-a.example.com',
    createdAt: new Date().toISOString(),
  };

  const tenantB: Tenant = {
    id: 'tenant-b-id',
    name: 'Tenant B',
    domain: 'tenant-b.example.com',
    createdAt: new Date().toISOString(),
  };

  await secureDb.createTenant(tenantA);
  await secureDb.createTenant(tenantB);

  return { tenantA, tenantB };
}

async function setupTestUsers(tenantA: Tenant, tenantB: Tenant) {
  const userA: User = {
    id: 'user-a-id',
    email: 'user-a@example.com',
    password: 'hashed-password-a',
    tenantId: tenantA.id,
    createdAt: new Date().toISOString(),
  };

  const userB: User = {
    id: 'user-b-id',
    email: 'user-b@example.com',
    password: 'hashed-password-b',
    tenantId: tenantB.id,
    createdAt: new Date().toISOString(),
  };

  await secureDb.createUser(userA);
  await secureDb.createUser(userB);

  return { userA, userB };
}

async function setupTestVideos(tenantA: Tenant, tenantB: Tenant) {
  const videoA: Video = {
    id: 'video-a-id',
    tenantId: tenantA.id,
    title: 'Video from Tenant A',
    description: 'This belongs to Tenant A',
    url: 'https://example.com/video-a.mp4',
    thumbnailUrl: 'https://example.com/thumb-a.jpg',
    duration: 120,
    views: 0,
    createdAt: new Date().toISOString(),
  };

  const videoB: Video = {
    id: 'video-b-id',
    tenantId: tenantB.id,
    title: 'Video from Tenant B',
    description: 'This belongs to Tenant B',
    url: 'https://example.com/video-b.mp4',
    thumbnailUrl: 'https://example.com/thumb-b.jpg',
    duration: 180,
    views: 0,
    createdAt: new Date().toISOString(),
  };

  await secureDb.createVideo(videoA, tenantA.id);
  await secureDb.createVideo(videoB, tenantB.id);

  return { videoA, videoB };
}

// ============================================
// TEST SUITE
// ============================================

async function runTests() {
  console.log('🧪 Starting Tenant Isolation Tests...\n');

  let passed = 0;
  let failed = 0;

  // Setup
  const { tenantA, tenantB } = await setupTestTenants();
  const { userA, userB } = await setupTestUsers(tenantA, tenantB);
  const { videoA, videoB } = await setupTestVideos(tenantA, tenantB);

  // ============================================
  // Test 1: Tenant A can access their own video
  // ============================================
  try {
    const video = await secureDb.getVideoById(videoA.id, tenantA.id);
    if (video && video.id === videoA.id) {
      console.log('✅ Test 1: Tenant A can access their own video');
      passed++;
    } else {
      console.error('❌ Test 1 FAILED: Tenant A cannot access their own video');
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 2: Tenant A CANNOT access Tenant B's video
  // ============================================
  try {
    const video = await secureDb.getVideoById(videoB.id, tenantA.id);
    if (video === null) {
      console.log('✅ Test 2: Tenant A blocked from accessing Tenant B video');
      passed++;
    } else {
      console.error('❌ Test 2 FAILED: Tenant A accessed Tenant B video! SECURITY BREACH!');
      console.error('   Video:', video);
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 3: Tenant B can access their own video
  // ============================================
  try {
    const video = await secureDb.getVideoById(videoB.id, tenantB.id);
    if (video && video.id === videoB.id) {
      console.log('✅ Test 3: Tenant B can access their own video');
      passed++;
    } else {
      console.error('❌ Test 3 FAILED: Tenant B cannot access their own video');
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 4: Tenant B CANNOT access Tenant A's video
  // ============================================
  try {
    const video = await secureDb.getVideoById(videoA.id, tenantB.id);
    if (video === null) {
      console.log('✅ Test 4: Tenant B blocked from accessing Tenant A video');
      passed++;
    } else {
      console.error('❌ Test 4 FAILED: Tenant B accessed Tenant A video! SECURITY BREACH!');
      console.error('   Video:', video);
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 5: getVideosByTenant only returns tenant's videos
  // ============================================
  try {
    const videosA = await secureDb.getVideosByTenant(tenantA.id);
    const videosB = await secureDb.getVideosByTenant(tenantB.id);

    if (videosA.length === 1 && videosA[0].id === videoA.id &&
        videosB.length === 1 && videosB[0].id === videoB.id) {
      console.log('✅ Test 5: getVideosByTenant correctly isolates data');
      passed++;
    } else {
      console.error('❌ Test 5 FAILED: getVideosByTenant returned wrong videos');
      console.error('   Tenant A videos:', videosA);
      console.error('   Tenant B videos:', videosB);
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 6: Cannot update video from different tenant
  // ============================================
  try {
    await secureDb.updateVideo(videoB.id, { title: 'Hacked!' }, tenantA.id);
    console.error('❌ Test 6 FAILED: Tenant A updated Tenant B video! SECURITY BREACH!');
    failed++;
  } catch (error) {
    console.log('✅ Test 6: Cross-tenant update blocked');
    passed++;
  }

  // ============================================
  // Test 7: Cannot delete video from different tenant
  // ============================================
  try {
    await secureDb.deleteVideo(videoB.id, tenantA.id);
    console.error('❌ Test 7 FAILED: Tenant A deleted Tenant B video! SECURITY BREACH!');
    failed++;
  } catch (error) {
    console.log('✅ Test 7: Cross-tenant delete blocked');
    passed++;
  }

  // ============================================
  // Test 8: Cannot increment views for different tenant
  // ============================================
  try {
    const beforeViews = videoB.views;
    await secureDb.incrementVideoViews(videoB.id, tenantA.id);
    const video = await secureDb.getVideoById(videoB.id, tenantB.id);
    
    if (video && video.views === beforeViews) {
      console.log('✅ Test 8: Cross-tenant view increment blocked');
      passed++;
    } else {
      console.error('❌ Test 8 FAILED: Tenant A incremented Tenant B views!');
      failed++;
    }
  } catch (error) {
    console.error('❌ Test 8 FAILED:', error);
    failed++;
  }

  // ============================================
  // Test 9: Cannot create video with mismatched tenantId
  // ============================================
  try {
    const maliciousVideo: Video = {
      id: 'malicious-video',
      tenantId: tenantB.id, // Trying to create video for Tenant B
      title: 'Malicious Video',
      description: 'Trying to inject into Tenant B',
      url: 'https://example.com/malicious.mp4',
      thumbnailUrl: '',
      duration: 60,
      views: 0,
      createdAt: new Date().toISOString(),
    };

    await secureDb.createVideo(maliciousVideo, tenantA.id); // But authenticated as Tenant A
    console.error('❌ Test 9 FAILED: Created video with mismatched tenantId! SECURITY BREACH!');
    failed++;
  } catch (error) {
    console.log('✅ Test 9: Mismatched tenantId creation blocked');
    passed++;
  }

  // ============================================
  // Test 10: Cannot modify tenantId of existing video
  // ============================================
  try {
    await secureDb.updateVideo(videoA.id, { tenantId: tenantB.id }, tenantA.id);
    const video = await secureDb.getVideoById(videoA.id, tenantA.id);
    
    if (video && video.tenantId === tenantA.id) {
      console.log('✅ Test 10: tenantId modification blocked');
      passed++;
    } else {
      console.error('❌ Test 10 FAILED: tenantId was modified! SECURITY BREACH!');
      failed++;
    }
  } catch (error) {
    console.log('✅ Test 10: tenantId modification blocked (exception)');
    passed++;
  }

  // ============================================
  // RESULTS
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Tenant isolation is working correctly.');
    return 0;
  } else {
    console.error('\n⚠️  SECURITY ISSUES DETECTED! Fix failed tests immediately.');
    return 1;
  }
}

// Run tests
runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
