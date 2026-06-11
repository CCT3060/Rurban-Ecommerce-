// PM2 process manager configuration for EC2
module.exports = {
  apps: [
    {
      name: 'rurban-ecommerce',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/rurban-ecommerce',
      instances: 1,
      exec_mode: 'fork',
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

  // Replace the Vercel cron — runs every hour on the EC2 server itself
  // PM2 doesn't support cron directly; we use a system crontab (see deploy guide)
};
