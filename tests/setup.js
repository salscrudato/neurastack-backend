// Load environment variables for testing
require('dotenv').config();

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});
