/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  clearMocks: true,
  collectCoverageFrom: [
    'app.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    'config/**/*.js',
  ],
};

