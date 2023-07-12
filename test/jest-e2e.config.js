module.exports = {
  testTimeout: 6000000,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['**/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        compiler: 'ttypescript',
      },
    ],
  },
  coverageDirectory: './coverage-e2e',
};
