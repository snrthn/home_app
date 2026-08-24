/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 bug
        'refactor', // 重构（不改变功能）
        'perf',     // 性能优化
        'style',    // 代码格式（不影响功能）
        'test',     // 测试相关
        'docs',     // 文档
        'ci',       // CI/CD
        'build',    // 构建/依赖
        'deploy',   // 部署
        'chore',    // 杂项
        'revert',   // 回滚
      ],
    ],
    'type-case': [0],
    'subject-case': [0],
    'subject-max-length': [2, 'always', 72],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};
