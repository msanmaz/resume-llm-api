// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { errorHandler } from './api/middleware/errorHandler.js';
import { limiter } from './api/middleware/rateLimiter.js';
import routes from './api/routes/index.js';
import { config } from './config/environment.js';
import { AppError } from './utils/errors/AppError.js'



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Apply security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  // credentials: true
}));

app.use(express.static(join(dirname(__dirname), 'public')));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiter
app.use('/api', limiter);

 // Register routes before error handling
app.use('/api', routes); 


// Error handling
app.use(errorHandler);

// Handle unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
});



export const application = app;
