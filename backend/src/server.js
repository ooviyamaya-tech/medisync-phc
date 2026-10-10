import 'dotenv/config';
import cron from 'node-cron';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { refreshAllAlerts } from './services/alerts.js';
import { seedIfEmpty } from '../prisma/seed.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) throw new Error('JWT_SECRET must contain at least 24 characters');

const port = Number(process.env.PORT ?? 3000);
await seedIfEmpty();
const server = app.listen(port, () => console.log(`MediSync PHC API listening on port ${port}`));
const cronExpression = process.env.ALERT_CRON ?? '0 * * * *';
if (cron.validate(cronExpression)) cron.schedule(cronExpression, () => refreshAllAlerts().catch(error => console.error('Scheduled alert refresh failed', error)));
else console.error(`Invalid ALERT_CRON expression: ${cronExpression}`);

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);