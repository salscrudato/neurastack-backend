// Load environment variables for testing
require('dotenv').config();

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';

// Initialize Firebase Admin for testing
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  try {
    // Use real Firebase service account for testing
    const serviceAccountPath = path.join(__dirname, '..', 'config', 'firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    console.log('✅ Firebase Admin initialized for testing with real service account');
  } catch (error) {
    console.warn('⚠️ Failed to initialize Firebase Admin with service account:', error.message);
    console.log('Falling back to environment variables...');

    // Fallback to environment variables if service account file not found
    if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      console.error('❌ No Firebase configuration found. Tests may fail.');
    }
  }
}

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});
