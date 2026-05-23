import app from './app';
import config from './config';

const server = app.listen(config.port, () => {
  console.log(`Care Hire backend listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shutdown complete');
  });
});
