#!/bin/bash

# 获取当前运行的 node 进程的 PID
PID_FILE="/www/server/nodejs/vhost/pids/nanobanana.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat $PID_FILE)
    # 如果进程存在，则杀掉
    if ps -p $PID > /dev/null; then
        echo "Stopping node (PID: $PID)..."
        kill $PID
        echo "node stopped."
    else
        echo "node process not found, skipping kill."
    fi
else
    echo "PID file not found, skipping kill."
fi

# 重新启动 node
echo "Starting node..."
/www/server/nodejs/vhost/scripts/nanobanana.sh

echo "node restarted."

