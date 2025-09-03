module.exports = {
  apps: [{
    name: 'nanobanana',
    script: './app.js',
    instances: 1,
    exec_mode: 'fork',
    
    // �,Mn
    port: 3000,
    node_args: '--max-old-space-size=512',
    
    // ����
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // OPENROUTER_API_KEY: '(�Tb-�n����'
    },
    
    // �/Ve
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s',
    
    // ��Mn
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // ��/a�
    autorestart: true,
    restart_delay: 4000,
    
    // ��
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // D�P6
    max_memory_restart: '300M',
    
    // e���
    health_check_grace_period: 3000
  }]
};