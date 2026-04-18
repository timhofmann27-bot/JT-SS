import pino from 'pino';
import pinoHttp from 'pino-http';

// Create logger instance
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Create HTTP logger middleware
const httpLogger = pinoHttp({
  logger,
  // Don't log health checks to reduce noise
  ignore: (req, res) => {
    return req.url === '/api/health' && res.statusCode === 200;
  },
  // Custom serializers
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      hostname: req.hostname,
      remoteAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export { logger, httpLogger };