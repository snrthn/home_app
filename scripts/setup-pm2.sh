#!/usr/bin/env bash
# PM2 环境初始化（生产服务器首次部署时执行一次）
# 用法: bash scripts/setup-pm2.sh
set -euo pipefail

echo "[1/3] 安装 pm2-logrotate 模块..."
pm2 install pm2-logrotate

echo "[2/3] 配置日志轮转策略..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 30

echo "[3/3] 完成。日志将在单文件超过 50M 时自动轮转，保留最近 14 份并压缩。"
