// PM2 process manager configuration for EC2
module.exports = {
  apps: [
    {
      name: 'rurban-ecommerce',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/rurban-ecommerce',
      // Cluster mode utilises all CPU cores and provides automatic fault tolerance.
      // If one process crashes, PM2 restarts it while others keep serving traffic.
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/rurban-error.log',
      out_file:   '/var/log/pm2/rurban-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
