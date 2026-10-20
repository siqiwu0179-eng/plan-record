#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
analytics_url='http://127.0.0.1:4318/analytics.html'
if curl --silent --fail "$analytics_url" >/dev/null 2>&1; then
  open -a 'Google Chrome' "$analytics_url" || open "$analytics_url"
  exit 0
fi
python3 scripts/serve-analytics.py &
analytics_pid=$!
trap 'kill "$analytics_pid" 2>/dev/null' EXIT
trap 'exit 0' INT TERM
for attempt in {1..40}; do
  if curl --silent --fail "$analytics_url" >/dev/null 2>&1; then
    print 'Analytics 已启动。关闭这个终端窗口会停止本次启动的服务。'
    open -a 'Google Chrome' "$analytics_url" || open "$analytics_url"
    wait "$analytics_pid"
    exit $?
  fi
  if ! kill -0 "$analytics_pid" 2>/dev/null; then
    print '服务启动失败，请查看上面的错误信息。'
    read '?按回车关闭。'
    exit 1
  fi
  sleep 0.25
done
print '服务启动超时，请查看上面的错误信息。'
read '?按回车关闭。'
exit 1
