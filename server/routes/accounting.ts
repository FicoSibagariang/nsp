import { Hono } from 'hono'
import { z } from 'zod'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  getAccountsList,
  createAccount,
  getJournalEntriesList,
  getJournalLinesByEntryId,
  createManualJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
  getTrialBalanceReport,
  getGeneralLedgerReport,
} from '../services/accountingService'
import { requireRouteParam } from '../lib/serviceResponse'
import { audit, getActor, getClientIp, getJwtPayload } from '../lib/audit'

const accounting = new Hono()

// ---------------------------------------------------------------------------
// Chart of Accounts (COA)
// ---------------------------------------------------------------------------

accounting.get('/accounts', requirePermission('read:accounting'), async (c) => {
  const accounts = await getAccountsList(db)
  return c.json({ success: true, data: accounts })
})

const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  normal_balance: z.enum(['DEBIT', 'CREDIT']),
})

accounting.post('/accounts', requirePermission('manage:accounting'), async (c) => {
  const body = await c.req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) return c.json({ success: false, errors: parsed.error.format() }, 400)

  const newId = await createAccount(db, parsed.data)

  await audit(db, {
    actor: getActor(c),
    action: 'create_account',
    entity: 'accounts',
    entityId: newId,
    after: parsed.data,
    ip: getClientIp(c),
  })

  return c.json({ success: true, message: 'Akun berhasil dibuat', id: newId }, 201)
})

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------

accounting.get('/journals', requirePermission('read:accounting'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const { rows, total } = await getJournalEntriesList(db, limit, offset)

  return c.json({
    success: true,
    data: {
      data: rows,
      total,
      page,
      limit,
    },
  })
})

accounting.get('/journals/:id/lines', requirePermission('read:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const lines = await getJournalLinesByEntryId(db, id)
  return c.json({ success: true, data: lines })
})

const journalLineSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional().nullable(),
})

const journalEntrySchema = z.object({
  transaction_date: z.string().min(1),
  description: z.string().min(1),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().uuid().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, "Jurnal minimal harus memiliki 2 baris (Debit & Kredit)"),
})

accounting.post('/journals', requirePermission('create:accounting'), async (c) => {
  const body = await c.req.json()
  const parsed = journalEntrySchema.safeParse(body)
  if (!parsed.success) return c.json({ success: false, errors: parsed.error.format() }, 400)

  const data = parsed.data
  const actor = getActor(c)
  const adminId = getJwtPayload(c)?.sub || null

  const entryId = await createManualJournalEntry(db, data, adminId)

  const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0)

  await audit(db, {
    actor,
    action: 'create_journal',
    entity: 'journal_entries',
    entityId: entryId,
    after: {
      ...data,
      total_amount: totalDebit
    },
    ip: getClientIp(c),
  })

  return c.json({ success: true, message: 'Jurnal berhasil dicatat', id: entryId }, 201)
})

// ---------------------------------------------------------------------------
// Journal Reversal (Koreksi / Storno)
// ---------------------------------------------------------------------------

accounting.post('/journals/:id/reverse', requirePermission('create:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const actor = getActor(c)
  const adminId = getJwtPayload(c)?.sub || null

  const reversalId = await reverseJournalEntry(db, id, adminId)

  await audit(db, {
    actor,
    action: 'reverse_journal',
    entity: 'journal_entries',
    entityId: reversalId,
    after: { reversed_entry_id: id },
    ip: getClientIp(c),
  })

  return c.json({ success: true, message: 'Jurnal koreksi berhasil dibuat', id: reversalId }, 201)
})

// ---------------------------------------------------------------------------
// Journal Delete (Hapus) — superadmin only
// ---------------------------------------------------------------------------

accounting.delete('/journals/:id', requirePermission('delete:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const actor = getActor(c)

  const entry = await deleteJournalEntry(db, id)

  await audit(db, {
    actor,
    action: 'delete_journal',
    entity: 'journal_entries',
    entityId: id,
    before: { description: entry.description, reference_type: entry.reference_type },
    ip: getClientIp(c),
  })

  return c.json({ success: true, message: 'Jurnal berhasil dihapus' })
})

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

accounting.get('/ledger', requirePermission('read:accounting'), async (c) => {
  const startDate = c.req.query('startDate')?.trim()
  const endDate = c.req.query('endDate')?.trim()

  const rows = await getTrialBalanceReport(db, startDate, endDate)
  return c.json({ success: true, data: rows })
})

accounting.get('/ledger/:accountId', requirePermission('read:accounting'), async (c) => {
  const accountId = requireRouteParam(c, 'accountId')
  const startDate = c.req.query('startDate')?.trim()
  const endDate = c.req.query('endDate')?.trim()

  const data = await getGeneralLedgerReport(db, accountId, startDate, endDate)
  if (!data) {
    return c.json({ success: false, error: 'Account not found' }, 404)
  }

  return c.json({ 
    success: true, 
    data,
  })
})

export default accounting
