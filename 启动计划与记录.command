#!/bin/zsh
cd "$(dirname "$0")"

if ! curl -s http://localhost:5173/ >/dev/null 2>&1; then
  nohup npm run dev -- --host 127.0.0.1 --port 5173 > ./计划与记录-server.log 2>&1 &
  sleep 2
fi

open http://localhost:5173/
