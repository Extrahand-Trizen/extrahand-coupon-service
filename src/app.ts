import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { validateEnv, getCorsConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import logger from './config/logger';

const env = validateEnv();

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors(getCorsConfig(env)));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(compression());
  app.use(mongoSanitize());

  if (env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        stream: { write: (message: string) => logger.info(message.trim()) },
      })
    );
  }

  app.get('/', (_req, res) => {
    res.json({
      service: 'extrahand-coupon-service',
      status: 'ok',
      health: '/api/v1/health',
    });
  });

  app.use('/api/v1', routes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  app.use(errorHandler);
  return app;
}
