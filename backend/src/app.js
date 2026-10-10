import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/health', (req, res) => res.json({ data: { status: 'ok', service: 'MediSync PHC API' } }));
app.use('/', routes);
app.use(notFound);
app.use(errorHandler);

export default app;