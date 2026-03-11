/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ["**/tests/**/*.test.ts"],
  resolver: 'jest-ts-webcompat-resolver',
  moduleNameMapper: {
    // This is needed for ESM to correctly resolve .js imports in compiled TS
    '^(\.{1,2}/.*)\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
