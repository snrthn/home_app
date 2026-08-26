/** @type {import('jest').Config} */
const config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.spec\\.ts$'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  // @laoma/shared 是预编译包，直接映射到 dist，避免 jest 走 node_modules 解析的不确定性
  moduleNameMapper: {
    '^@laoma/shared$': '<rootDir>/../../shared/dist/index.js',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/*.dto.ts',
    '!**/main.ts',
    '!**/*.e2e.spec.ts',
    '!**/e2e/**',
    '!**/test/**',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      statements: 12,
      branches: 10,
      functions: 8,
      lines: 12,
    },
  },
  testEnvironment: 'node',
};

module.exports = config;
