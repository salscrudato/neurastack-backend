// Load environment variables for testing
require('dotenv').config();

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';

// Initialize Firebase Admin for testing
const admin = require('firebase-admin');

if (!admin.apps.length) {
  // Use a mock service account for testing
  const mockServiceAccount = {
    type: "service_account",
    project_id: "test-project",
    private_key_id: "test-key-id",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nxhXBaaxLQO/Q6PKjYIYlvA4E0yyHuKjEHxpOi2lOPVX9AjgmXvqg5aNdqeM2VgL\n7YudBih7XpSUjjjXWmnLGlHHGXHc5VYM6Ch8Iv6Rt6uEXEGz6QGBaebgBFcnyqQn\nBoFiaNbcqLEVBY/Hq1dmaJVqw5s4YgEQDRwQuwqyonHaM83HWrAVhfNDbBMxUBtQ\nKVD43TxCVidwDroEd21VBcAqhpGw6rKin2qSw8/dLl6qiXFjyH7FqHgiVelFHgpI\nkfLawoqQZ+0=\n-----END PRIVATE KEY-----\n",
    client_email: "test@test-project.iam.gserviceaccount.com",
    client_id: "123456789",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token"
  };

  admin.initializeApp({
    credential: admin.credential.cert(mockServiceAccount),
    projectId: 'test-project'
  });
}

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});
