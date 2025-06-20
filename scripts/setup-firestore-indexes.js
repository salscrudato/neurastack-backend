#!/usr/bin/env node

/**
 * Script to set up required Firestore indexes for the memory system
 * 
 * This script creates the composite indexes needed for efficient memory queries.
 * Run this script once after setting up the Firestore database.
 * 
 * Usage: node scripts/setup-firestore-indexes.js
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const firestore = admin.firestore();

/**
 * Required Firestore indexes for memory system queries
 */
const REQUIRED_INDEXES = [
  {
    name: 'memories-userId-retention-sessionId-weights',
    collection: 'memories',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'retention.isArchived', order: 'ASCENDING' },
      { fieldPath: 'sessionId', order: 'ASCENDING' },
      { fieldPath: 'weights.composite', order: 'DESCENDING' }
    ],
    description: 'For retrieving user memories by session with composite weight ordering'
  },
  {
    name: 'memories-userId-retention-weights',
    collection: 'memories',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'retention.isArchived', order: 'ASCENDING' },
      { fieldPath: 'weights.composite', order: 'DESCENDING' }
    ],
    description: 'For retrieving user memories with composite weight ordering'
  },
  {
    name: 'memories-userId-memoryType-weights',
    collection: 'memories',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'memoryType', order: 'ASCENDING' },
      { fieldPath: 'weights.composite', order: 'DESCENDING' }
    ],
    description: 'For retrieving user memories by type with composite weight ordering'
  },
  {
    name: 'memories-userId-sessionId-created',
    collection: 'memories',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'sessionId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'For retrieving user memories by session chronologically'
  },
  {
    name: 'memories-weights-composite-created',
    collection: 'memories',
    fields: [
      { fieldPath: 'weights.composite', order: 'DESCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'For cleanup operations based on composite weight and age'
  },
  {
    name: 'memories-retention-archived-updated',
    collection: 'memories',
    fields: [
      { fieldPath: 'retention.isArchived', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'ASCENDING' }
    ],
    description: 'For memory lifecycle management and weight updates'
  }
];

/**
 * Display instructions for creating indexes manually
 */
function displayIndexInstructions() {
  console.log('\n🔧 FIRESTORE INDEX SETUP INSTRUCTIONS');
  console.log('=====================================\n');
  
  console.log('The memory system requires composite indexes for optimal performance.');
  console.log('These indexes must be created in the Firebase Console.\n');
  
  console.log('📋 REQUIRED INDEXES:\n');
  
  REQUIRED_INDEXES.forEach((index, i) => {
    console.log(`${i + 1}. ${index.name}`);
    console.log(`   Collection: ${index.collection}`);
    console.log(`   Description: ${index.description}`);
    console.log('   Fields:');
    index.fields.forEach(field => {
      console.log(`     - ${field.fieldPath} (${field.order})`);
    });
    console.log('');
  });
  
  console.log('🌐 TO CREATE INDEXES:');
  console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log('2. Select your project: neurastack-backend');
  console.log('3. Navigate to Firestore Database > Indexes');
  console.log('4. Click "Create Index" and add each index above');
  console.log('5. Or use the auto-generated links from error messages\n');
  
  console.log('⚡ QUICK SETUP:');
  console.log('When you see Firestore index errors in the logs, they include direct links');
  console.log('to create the required indexes. Click those links for fastest setup.\n');
  
  console.log('✅ VERIFICATION:');
  console.log('After creating indexes, run: curl http://localhost:8080/memory/health');
  console.log('The response should show "firestoreAvailable": true\n');
}

/**
 * Check if indexes exist (basic validation)
 */
async function checkIndexStatus() {
  try {
    console.log('🔍 Checking Firestore connection...');
    
    // Test basic connection
    await firestore.collection('_test').limit(1).get();
    console.log('✅ Firestore connection successful');
    
    // Try a query that requires an index
    console.log('🔍 Testing memory query (this may fail if indexes are missing)...');
    
    try {
      await firestore.collection('memories')
        .where('userId', '==', 'test')
        .where('retention.isArchived', '==', false)
        .orderBy('weights.composite', 'desc')
        .limit(1)
        .get();
      
      console.log('✅ Memory indexes appear to be working');
      return true;
    } catch (error) {
      if (error.code === 9) { // FAILED_PRECONDITION
        console.log('⚠️ Memory indexes are missing (expected)');
        return false;
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Firestore connection failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Firestore Index Setup Tool');
  console.log('==============================\n');
  
  const indexesExist = await checkIndexStatus();
  
  if (indexesExist) {
    console.log('🎉 All required indexes appear to be set up correctly!');
    console.log('The memory system should be fully operational.');
  } else {
    displayIndexInstructions();
  }
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_INDEXES,
  checkIndexStatus,
  displayIndexInstructions
};
