module.exports = {
  apps: [{
    name: 'BennyBombsBot',
    script: 'bot.js',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 5000,      // wait 5s before restarting after a crash
    max_restarts: 10,         // stop trying after 10 rapid crashes
    min_uptime: '10s',        // must stay up 10s to count as a successful start
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
