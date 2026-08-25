// PM2 进程配置（SSH+PM2 部署方案）。
// 用法: pm2 start ecosystem.config.js
// 说明：
//   - exec_mode: fork（next start / nest 均为单进程，不适合 cluster）
//   - PORT 显式 3721（三七二十一），前端 3824（三八二十四）—— 九九乘法表品牌端口，与开发环境一致
//   - 日志：nest 用 Pino 输出结构化 JSON 到 stdout/stderr，PM2 捕获落盘 + 轮转；
//     安装 pm2-logrotate 后配置：pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 50M
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