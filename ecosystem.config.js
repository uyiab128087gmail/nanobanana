module.exports = {
  apps: [{
    name: 'nanobanana',
    script: './app.js',
    instances: 1,
    exec_mode: 'fork',
    
    // 基础配置
    port: 3008,
    node_args: '--max-old-space-size=512',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3008,
      // OPENROUTER_API_KEY: '在这里设置你的密钥'
    },
    
    // 监控配置
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s',
    
    // 日志配置
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启
    autorestart: true,
    restart_delay: 4000,
    
    // 超时设置
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // 内存限制
    max_memory_restart: '300M',
    
    // 健康检查
    health_check_grace_period: 3000
  }]
};