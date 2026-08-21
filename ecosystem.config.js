// PM2 进程配置（SSH+PM2 部署方案）。
// 用法: pm2 start ecosystem.config.js
// 说明：
//   - exec_mode: fork（next start / nest 均为单进程，不适合 cluster）
//   - PORT 显式 4200，与 nest/.env 一致；敏感密钥一律放 nest/.env（不入库）
module.exports = {
  apps: [
    {
      name: 'laoma-next',
      cwd: './next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3200',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
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
      env: { NODE_ENV: 'production', PORT: 4200 },
    },
  ],
};