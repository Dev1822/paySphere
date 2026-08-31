module.exports = {
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|@scure|@exodus|otplib))'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
