#!/usr/bin/env node

/**
 * Firebase Diagnostics Script
 * Comprehensive testing and troubleshooting for Firebase backend integration
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class FirebaseDiagnostics {
  constructor() {
    this.results = {
      configurationCheck: false,
      credentialsCheck: false,
      connectionCheck: false,
      permissionsCheck: false,
      firestoreOperations: false,
      overallHealth: false
    };
  }

  async runDiagnostics() {
    log('cyan', '🔥 Firebase Backend Diagnostics');
    log('cyan', '================================');
    console.log();

    try {
      await this.checkConfiguration();
      await this.checkCredentials();
      await this.testConnection();
      await this.testPermissions();
      await this.testFirestoreOperations();
      
      this.generateReport();
      this.provideSolutions();
      
    } catch (error) {
      log('red', `❌ Diagnostics failed: ${error.message}`);
      this.provideSolutions();
    }
  }

  async checkConfiguration() {
    log('blue', '1. Checking Firebase Configuration...');

    try {
      // Check for Firebase Admin SDK key first (preferred)
      let serviceAccountPath = path.join(process.cwd(), 'firebase-admin-key.json');
      let serviceAccountType = 'Firebase Admin SDK';

      if (!fs.existsSync(serviceAccountPath)) {
        // Fallback to original service account file
        serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        serviceAccountType = 'Storage Service Account';
      }

      if (fs.existsSync(serviceAccountPath)) {
        log('green', `   ✅ ${serviceAccountType} file found`);

        // Validate service account structure
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];

        for (const field of requiredFields) {
          if (!serviceAccount[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }

        log('green', '   ✅ Service account structure valid');
        log('cyan', `   📋 Project ID: ${serviceAccount.project_id}`);
        log('cyan', `   📋 Client Email: ${serviceAccount.client_email}`);
        log('cyan', `   📋 Type: ${serviceAccountType}`);

        // Store the path for later use
        this.serviceAccountPath = serviceAccountPath;
        this.results.configurationCheck = true;
      } else {
        throw new Error('No service account file found (checked firebase-admin-key.json and serviceAccountKey.json)');
      }

    } catch (error) {
      log('red', `   ❌ Configuration check failed: ${error.message}`);
      this.results.configurationCheck = false;
    }

    console.log();
  }

  async checkCredentials() {
    log('blue', '2. Checking Firebase Credentials...');

    try {
      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        const serviceAccount = require(this.serviceAccountPath || path.join(process.cwd(), 'firebase-admin-key.json'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        log('green', '   ✅ Firebase Admin initialized');
      }

      this.results.credentialsCheck = true;

    } catch (error) {
      log('red', `   ❌ Credentials check failed: ${error.message}`);
      this.results.credentialsCheck = false;
    }

    console.log();
  }

  async testConnection() {
    log('blue', '3. Testing Firestore Connection...');
    
    try {
      const firestore = admin.firestore();
      
      // Test basic connection with a simple query
      await firestore.collection('_diagnostics').limit(1).get();
      log('green', '   ✅ Firestore connection successful');
      
      this.results.connectionCheck = true;
      
    } catch (error) {
      log('red', `   ❌ Connection test failed: ${error.message}`);
      
      // Provide specific error analysis
      if (error.message.includes('UNAUTHENTICATED')) {
        log('yellow', '   ⚠️  Authentication issue detected');
        log('yellow', '   ⚠️  Service account may lack proper permissions');
      } else if (error.message.includes('PERMISSION_DENIED')) {
        log('yellow', '   ⚠️  Permission denied - check IAM roles');
      } else if (error.message.includes('NOT_FOUND')) {
        log('yellow', '   ⚠️  Project or database not found');
      }
      
      this.results.connectionCheck = false;
    }
    
    console.log();
  }

  async testPermissions() {
    log('blue', '4. Testing Firestore Permissions...');
    
    if (!this.results.connectionCheck) {
      log('yellow', '   ⏭️  Skipping permissions test (connection failed)');
      console.log();
      return;
    }
    
    try {
      const firestore = admin.firestore();
      const testCollection = firestore.collection('_diagnostics_test');
      const testDoc = testCollection.doc('permission_test');
      
      // Test write permission
      await testDoc.set({
        test: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: 'Firebase diagnostics test'
      });
      log('green', '   ✅ Write permission confirmed');
      
      // Test read permission
      const doc = await testDoc.get();
      if (doc.exists) {
        log('green', '   ✅ Read permission confirmed');
      }
      
      // Test delete permission
      await testDoc.delete();
      log('green', '   ✅ Delete permission confirmed');
      
      this.results.permissionsCheck = true;
      
    } catch (error) {
      log('red', `   ❌ Permissions test failed: ${error.message}`);
      this.results.permissionsCheck = false;
    }
    
    console.log();
  }

  async testFirestoreOperations() {
    log('blue', '5. Testing Core Firestore Operations...');
    
    if (!this.results.permissionsCheck) {
      log('yellow', '   ⏭️  Skipping operations test (permissions failed)');
      console.log();
      return;
    }
    
    try {
      const firestore = admin.firestore();
      
      // Test memory collection operations (core to your app)
      const memoryCollection = firestore.collection('memories');
      const testMemory = {
        userId: 'diagnostics-test',
        content: 'Test memory for diagnostics',
        type: 'working',
        weight: 1.0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await memoryCollection.add(testMemory);
      log('green', '   ✅ Memory collection write successful');
      
      // Test workout history operations
      const workoutCollection = firestore.collection('workouts');
      const testWorkout = {
        userId: 'diagnostics-test',
        workoutId: 'test-workout-123',
        exercises: [],
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await workoutCollection.doc('test-workout').set(testWorkout);
      log('green', '   ✅ Workout collection write successful');
      
      // Clean up test data
      await docRef.delete();
      await workoutCollection.doc('test-workout').delete();
      log('green', '   ✅ Test data cleanup successful');
      
      this.results.firestoreOperations = true;
      
    } catch (error) {
      log('red', `   ❌ Operations test failed: ${error.message}`);
      this.results.firestoreOperations = false;
    }
    
    console.log();
  }

  generateReport() {
    log('magenta', '📊 Diagnostic Report');
    log('magenta', '===================');
    
    const checks = [
      { name: 'Configuration', status: this.results.configurationCheck },
      { name: 'Credentials', status: this.results.credentialsCheck },
      { name: 'Connection', status: this.results.connectionCheck },
      { name: 'Permissions', status: this.results.permissionsCheck },
      { name: 'Operations', status: this.results.firestoreOperations }
    ];
    
    checks.forEach(check => {
      const icon = check.status ? '✅' : '❌';
      const color = check.status ? 'green' : 'red';
      log(color, `${icon} ${check.name}`);
    });
    
    const passedChecks = checks.filter(c => c.status).length;
    const totalChecks = checks.length;
    
    this.results.overallHealth = passedChecks === totalChecks;
    
    console.log();
    log('cyan', `Overall Health: ${passedChecks}/${totalChecks} checks passed`);
    
    if (this.results.overallHealth) {
      log('green', '🎉 Firebase backend is fully operational!');
    } else {
      log('yellow', '⚠️  Firebase backend needs attention');
    }
    
    console.log();
  }

  provideSolutions() {
    log('yellow', '🔧 Troubleshooting Solutions');
    log('yellow', '============================');
    
    if (!this.results.configurationCheck) {
      log('yellow', '📋 Configuration Issues:');
      console.log('   • Ensure serviceAccountKey.json exists in project root');
      console.log('   • Verify all required fields are present');
      console.log('   • Check file permissions and JSON syntax');
      console.log();
    }
    
    if (!this.results.connectionCheck) {
      log('yellow', '🔌 Connection Issues:');
      console.log('   • Service account may need Firestore permissions');
      console.log('   • Run: gcloud projects add-iam-policy-binding neurastack-backend \\');
      console.log('     --member="serviceAccount:firebase-storage-access@neurastack-backend.iam.gserviceaccount.com" \\');
      console.log('     --role="roles/datastore.user"');
      console.log('   • Also add: --role="roles/firebase.admin"');
      console.log('   • Enable Firestore API in Google Cloud Console');
      console.log();
    }
    
    if (!this.results.permissionsCheck) {
      log('yellow', '🔐 Permission Issues:');
      console.log('   • Service account needs additional IAM roles:');
      console.log('     - Cloud Datastore User');
      console.log('     - Firebase Admin SDK Administrator Service Agent');
      console.log('   • Check Firebase project settings');
      console.log();
    }
    
    log('blue', '🚀 Quick Fix Commands:');
    console.log('   1. Enable APIs:');
    console.log('      gcloud services enable firestore.googleapis.com --project=neurastack-backend');
    console.log('      gcloud services enable firebase.googleapis.com --project=neurastack-backend');
    console.log();
    console.log('   2. Add IAM permissions:');
    console.log('      gcloud projects add-iam-policy-binding neurastack-backend \\');
    console.log('        --member="serviceAccount:firebase-storage-access@neurastack-backend.iam.gserviceaccount.com" \\');
    console.log('        --role="roles/datastore.user"');
    console.log();
    console.log('   3. Test again:');
    console.log('      node scripts/firebase-diagnostics.js');
  }
}

// Run diagnostics if called directly
if (require.main === module) {
  const diagnostics = new FirebaseDiagnostics();
  diagnostics.runDiagnostics().catch(console.error);
}

module.exports = FirebaseDiagnostics;
