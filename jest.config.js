module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],

  globals: {
    __DEV__: true,
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  clearMocks: true,

  transform: {
    '^.+\\.tsx?$': '<rootDir>/node_modules/ts-jest',
  },

  silent: false,
  verbose: true,

  // testRunner: 'jest-jasmine2',
  // reporters: ['default', 'jest-allure'],
  // setupFilesAfterEnv: ['./jest.setup.js'],
};
