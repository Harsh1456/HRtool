module.exports = {
  apps: [
    {
      name: 'hr-backend',
      script: 'uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8000 --workers 4',
      cwd: './backend',
      interpreter: './venv/bin/python',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
