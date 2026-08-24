/** @type {import('jest').Config} */
const config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  // @laoma/shared 是预编译包，直接映射到 dist，避免 jest 走 node_modules 解析的不确定性
  moduleNameMapper: {
    '^@laoma/shared$': '<rootDir>/../../shared/dist/index.js',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  testEnvironment: 'node',
};

module.exports = config;
