module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 30000,
  // Set test env variables
  setupFiles: ['./tests/setup.js'],
  // Use locally available MongoDB binary
  globals: {
    'globalConfig': {
      mongodbMemoryServerOptions: {
        binary: {
          version: '7.0.14',
        },
        instance: {
          dbName: 'ipms_test',
        },
      },
    },
  },
};
