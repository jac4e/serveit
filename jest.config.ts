import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts'],
  transformIgnorePatterns: [
    "node_modules/(?!typesit/.*)"
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsConfig: 'tsconfig.json',
    }],
    "node_modules/typesit/.+\\.(j|t)sx?$": "ts-jest",
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
};

export default config;