/**
 * Setup Admin Users Script
 * Creates admin user documents in Firestore for monitoring dashboard access
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'neurastack-backend-bucket1.appspot.com',
  });
}

const db = admin.firestore();

/**
 * Create or update admin user in Firestore
 * @param {string} uid - Firebase Auth UID
 * @param {string} email - User email
 * @param {string} role - User role (admin)
 */
async function createAdminUser(uid, email, role = 'admin') {
  try {
    const userDoc = {
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      permissions: ['read', 'write', 'admin'],
      tier: 'premium'
    };

    await db.collection('users').doc(uid).set(userDoc, { merge: true });
    console.log(`✅ Admin user created/updated: ${email} (${uid})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create admin user ${email}:`, error.message);
    return false;
  }
}

/**
 * Create Firebase Auth user and Firestore document
 * @param {string} email - User email
 * @param {string} password - User password
 */
async function createCompleteAdminUser(email, password) {
  try {
    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        emailVerified: true,
        disabled: false
      });
      console.log(`✅ Firebase Auth user created: ${email} (${userRecord.uid})`);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        // User already exists, get the user record
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`ℹ️ Firebase Auth user already exists: ${email} (${userRecord.uid})`);
      } else {
        throw authError;
      }
    }

    // Create Firestore document
    await createAdminUser(userRecord.uid, email);
    
    return {
      uid: userRecord.uid,
      email: email,
      success: true
    };
  } catch (error) {
    console.error(`❌ Failed to create complete admin user ${email}:`, error.message);
    return {
      email: email,
      success: false,
      error: error.message
    };
  }
}

/**
 * List all admin users
 */
async function listAdminUsers() {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'admin').get();
    
    if (snapshot.empty) {
      console.log('ℹ️ No admin users found');
      return [];
    }

    const adminUsers = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      adminUsers.push({
        uid: doc.id,
        email: userData.email,
        role: userData.role,
        createdAt: userData.createdAt?.toDate?.() || 'Unknown'
      });
    });

    console.log(`\n📋 Found ${adminUsers.length} admin user(s):`);
    adminUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.uid}) - Created: ${user.createdAt}`);
    });

    return adminUsers;
  } catch (error) {
    console.error('❌ Failed to list admin users:', error.message);
    return [];
  }
}

/**
 * Main setup function
 */
async function setupAdminUsers() {
  console.log('🚀 Setting up admin users for NeuraStack monitoring dashboard...\n');

  // Default admin users to create
  const defaultAdmins = [
    {
      email: 'admin@admin.com',
      password: 'admin123' // Simple credentials for development (6+ chars required)
    }
  ];

  // Check for environment variables
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    defaultAdmins.push({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
  }

  console.log(`📝 Creating ${defaultAdmins.length} admin user(s)...\n`);

  const results = [];
  for (const admin of defaultAdmins) {
    const result = await createCompleteAdminUser(admin.email, admin.password);
    results.push(result);
  }

  console.log('\n📊 Setup Results:');
  results.forEach(result => {
    if (result.success) {
      console.log(`  ✅ ${result.email} - Successfully created/updated`);
    } else {
      console.log(`  ❌ ${result.email} - Failed: ${result.error}`);
    }
  });

  console.log('\n📋 Current admin users:');
  await listAdminUsers();

  console.log('\n🔐 Login Instructions:');
  console.log('1. Navigate to http://localhost:8080/monitor (or your deployed URL)');
  console.log('2. Use the admin credentials to sign in');
  console.log('3. Access the monitoring dashboard');
  
  console.log('\n⚠️ Security Notes:');
  console.log('- Change default passwords in production');
  console.log('- Use environment variables for admin credentials');
  console.log('- Enable 2FA for admin accounts in production');
  console.log('- Regularly audit admin access');

  process.exit(0);
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupAdminUsers().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

module.exports = {
  createAdminUser,
  createCompleteAdminUser,
  listAdminUsers,
  setupAdminUsers
};
