// PM2 进程配置（SSH+PM2 部署方案）。
// 用法: pm2 start ecosystem.config.js --env production
// 说明：
//   - nest 进程 cwd=./nest，使 NestJS ConfigModule 能读取 nest/.env（JWT/DATABASE_URL 等）
//   - PORT 在此显式设为 4000，与 nest/.env 保持一致；不在此放任何敏感密钥
//   - 敏感配置一律放 nest/.env（生产服务器手动放置，不入库）
module.exports = {
  apps: [
    {
      name: 'laoma-next',
      cwd: './next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'laoma-nest',
      cwd: './nest',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
