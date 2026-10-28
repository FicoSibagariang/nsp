import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { getNplReport } from '../services/nplService'

const npl = new Hono()

npl.get('/', requirePermission('read:npl'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))

  const result = await getNplReport(db, page, limit)

  return c.json({
    success: true,
    data: result,
  })
})

export default npl
