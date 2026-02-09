
module.exports = {
  apps: [
    {
      name: "report-api",
      script: "dist/server.js",
      instances: 1,    
      exec_mode: "fork",  
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },

      // 로그
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // 안정성
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
