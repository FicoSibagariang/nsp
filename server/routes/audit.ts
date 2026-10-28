import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { getAuditLogsList, getAuditStats } from '../services/auditService'

const auditRouter = new Hono()

/**
 * GET /api/v1/audit-logs — List audit log entries with filters.
 * Requires manage:users permission (superadmin only).
 */
auditRouter.get('/', requirePermission('manage:users'), async (c) => {
  const actor = c.req.query('actor')
  const action = c.req.query('action')
  const entity = c.req.query('entity')
  const entityId = c.req.query('entityId')
  const from = c.req.query('from')   // ISO date string
  const to = c.req.query('to')        // ISO date string
  const limitRaw = c.req.query('limit') || '50'
  const offsetRaw = c.req.query('offset') || '0'

  const limit = Math.min(parseInt(limitRaw, 10), 200)
  const offset = parseInt(offsetRaw, 10)

  const rows = await getAuditLogsList(db, {
    actor,
    action,
    entity,
    entityId,
    from,
    to,
    limit,
    offset,
  })

  return c.json({ success: true, data: rows })
})

/**
 * GET /api/v1/audit-logs/stats — Summary counts grouped by action.
 * Requires manage:users permission (superadmin only).
 */
auditRouter.get('/stats', requirePermission('manage:users'), async (c) => {
  const rows = await getAuditStats(db)
  return c.json({ success: true, data: rows })
})

export default auditRouter
