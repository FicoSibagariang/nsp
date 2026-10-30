import { Hono } from 'hono';
import { timingSafeEqual, createHash } from 'node:crypto';
import db from '../db';
import { processDueDatesJob } from '../services/cronService';

const cronRoutes = new Hono();

// A simple authentication middleware for cron endpoints
cronRoutes.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  let cronSecret = process.env.CRON_SECRET || Bun.env.CRON_SECRET;
  
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return c.json({ success: false, message: 'Cron secret is not configured' }, 500);
    }
    cronSecret = 'default-cron-secret';
  }
  
  if (!authHeader) {
    return c.json({ success: false, message: 'Unauthorized cron access' }, 401);
  }

  const expected = `Bearer ${cronSecret}`;
  const headerHash = createHash('sha256').update(authHeader).digest();
  const expectedHash = createHash('sha256').update(expected).digest();

  if (!timingSafeEqual(headerHash, expectedHash)) {
    return c.json({ success: false, message: 'Unauthorized cron access' }, 401);
  }
  return next();
});

cronRoutes.post('/due-dates', async (c) => {
  try {
    const stats = await processDueDatesJob(db);

    return c.json({ 
      success: true, 
      message: 'Cron job executed successfully', 
      stats,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

export default cronRoutes;
