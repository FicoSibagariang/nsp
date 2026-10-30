import { Hono } from 'hono'
import { requirePermission } from '../middleware'
import {
  getReportsSummary,
  getMonthlyInterestReport,
  getRevenueProjectionReport,
  getAccountsReceivableReport,
  getSavingsMemberReport,
  getCashflowStatementReport,
  getIncomeStatementReport,
  getBalanceSheetReport
} from '../services/reportService'

const reports = new Hono()

reports.get('/summary', requirePermission('read:reports'), async (c) => {
  const data = await getReportsSummary()
  return c.json({ success: true, data })
})

reports.get('/monthly-interest', requirePermission('read:reports'), async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString()
  const data = await getMonthlyInterestReport(year)
  return c.json({ success: true, data })
})

reports.get('/revenue-projection', requirePermission('read:reports'), async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString()
  const data = await getRevenueProjectionReport(year)
  return c.json({ success: true, data })
})

reports.get('/ar', requirePermission('read:reports'), async (c) => {
  const data = await getAccountsReceivableReport()
  return c.json({ success: true, data })
})

reports.get('/savings-member', requirePermission('read:reports'), async (c) => {
  const data = await getSavingsMemberReport()
  return c.json({ success: true, data })
})

reports.get('/cashflow-statement', requirePermission('read:reports'), async (c) => {
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const data = await getCashflowStatementReport(startDate, endDate)
  return c.json({ success: true, data })
})

reports.get('/income-statement', requirePermission('read:reports'), async (c) => {
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const data = await getIncomeStatementReport(startDate, endDate)
  return c.json({ success: true, data })
})

reports.get('/balance-sheet', requirePermission('read:reports'), async (c) => {
  const endDate = c.req.query('endDate') || c.req.query('asOfDate')
  const data = await getBalanceSheetReport(endDate)
  return c.json({ success: true, data })
})

export default reports
