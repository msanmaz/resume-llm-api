export default {
    transform: {},
    // Removed extensionsToTreatAsEsm since it's automatically inferred
    testEnvironment: 'node',
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
      'src/**/*.js',
      '!**/node_modules/**',
    ],
  };