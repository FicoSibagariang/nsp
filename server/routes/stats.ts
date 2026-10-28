import { Hono } from 'hono'
import { requirePermission } from '../middleware'
import {
  clearStatsCache,
  getDashboardStats,
  getPendingActionsStats
} from '../services/statsService'

export { clearStatsCache }

const stats = new Hono()

stats.get('/', requirePermission('read:stats'), async (c) => {
  const data = await getDashboardStats()
  return c.json({ success: true, data })
})

stats.get('/pending-actions', requirePermission('read:stats'), async (c) => {
  const data = await getPendingActionsStats()
  return c.json({ success: true, data })
})

export default stats
