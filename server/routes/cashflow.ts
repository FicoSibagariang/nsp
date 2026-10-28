import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { getCashflowData } from '../services/cashflowService'

const cashflow = new Hono()

cashflow.get('/', requirePermission('read:cashflow'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const { data, total, totalInflow, totalOutflow, netCash } = await getCashflowData(db, limit, offset)

  return c.json({
    success: true,
    data: {
      data,
      total,
      page,
      limit,
      summary: {
        totalInflow,
        totalOutflow,
        netCash
      }
    }
  })
})

export default cashflow
