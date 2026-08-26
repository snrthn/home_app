// PM2 进程配置（SSH+PM2 部署方案）。
// 用法: pm2 start ecosystem.config.js
// 说明：
//   - exec_mode: fork（next start / nest 均为单进程，不适合 cluster）
//   - PORT 显式 3721（三七二十一），前端 3824（三八二十四）—— 九九乘法表品牌端口，与开发环境一致
//   - 日志：nest 用 Pino 输出结构化 JSON 到 stdout/stderr，PM2 捕获落盘 + 轮转；
//     日志轮转通过 pm2-logrotate 实现，首次部署执行：bash scripts/setup-pm2.sh
//     策略：单文件超过 50M 轮转，保留最近 14 份，自动 gzip 压缩
module.exports = {
  apps: [
    {
      name: 'laoma-next',
      cwd: './next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3824',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      out_file: './logs/next-out.log',
      error_file: './logs/next-error.log',
      merge_logs: true,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'laoma-nest',
      cwd: './nest',
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      out_file: './logs/nest-out.log',
      error_file: './logs/nest-error.log',
      merge_logs: true,
      env: { NODE_ENV: 'production', PORT: 3721 },
    },
  ],
};