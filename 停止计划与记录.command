#!/bin/zsh
pkill -f "vite.*5173" >/dev/null 2>&1 || true
pkill -f "npm run dev.*5173" >/dev/null 2>&1 || true
echo "计划与记录本地服务已停止。"
