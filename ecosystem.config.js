module.exports = {
  apps: [{
    name: 'nanobanana',
    script: './app.js',
    instances: 1,
    exec_mode: 'fork',
    
    // ú,Mn
    port: 3000,
    node_args: '--max-old-space-size=512',
    
    // ¯ƒØÏ
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // OPENROUTER_API_KEY: '(Tb-¾n¯ƒØÏ'
    },
    
    // Í/Ve
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s',
    
    // å×Mn
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // ê¨Í/aö
    autorestart: true,
    restart_delay: 4000,
    
    // Û¡
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // DP6
    max_memory_restart: '300M',
    
    // e·Àå
    health_check_grace_period: 3000
  }]
};