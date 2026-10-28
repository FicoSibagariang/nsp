import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import db from '../db'
import type { MemberRow, TransactionRow } from '../db/entities'
import {
  memberCreateSchema,
  memberPortalAccessSchema,
  memberSchema,
  savingsSchema,
} from '../schemas'
import { requirePermission, secretKey } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  createMember,
  deleteMember,
  setMemberPortalAccess,
  updateMember,
  batchImportMembers,
  listMembers,
  getMemberForImpersonation,
  getMemberTransactions,
} from '../services/memberService'
import { updateMemberSavings } from '../services/savingsService'
import { requireRouteParam } from '../lib/serviceResponse'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'
import { batchMemberImportSchema } from '../schemas'

const members = new Hono()

members.get('/', requirePermission('read:members'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const fetchAll = c.req.query('all') === 'true'

  const { rows, total } = await listMembers(db, {
    page,
    limit,
    includeArchived: c.req.query('includeArchived') === 'true',
    search: c.req.query('search')?.trim(),
    status: c.req.query('status')?.trim(),
    role: c.req.query('role')?.trim(),
    unpaidPokokOnly: c.req.query('unpaidPokokOnly') === 'true',
    fetchAll,
  })

  return c.json({
    success: true,
    data: {
      data: rows,
      total,
      page: fetchAll ? 1 : page,
      limit: fetchAll ? rows.length : limit
    }
  })
})

members.delete('/:id', requirePermission('delete:members'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const before = await deleteMember(db, id)

  await audit(db, {
    actor: getActor(c),
    action: 'archive_member',
    entity: 'members',
    entityId: id,
    before: { name: before.name, role: before.role },
    after: { deletedAt: new Date().toISOString() },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Member archived successfully' })
})

members.post('/', requirePermission('create:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberCreateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const { id, hasPortalAccess } = await createMember(db, parsed.data, getActor(c))

  await audit(db, {
    actor: getActor(c),
    action: 'create_member',
    entity: 'members',
    entityId: id,
    after: {
      name: parsed.data.name,
      role: parsed.data.role,
      status: parsed.data.status,
      joinDate: parsed.data.joinDate,
      nik: parsed.data.nik ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      hasPortalAccess,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({
    success: true,
    message: hasPortalAccess
      ? 'Anggota berhasil ditambahkan dan akses portal diaktifkan'
      : 'Member created successfully',
    id,
    data: { id, hasPortalAccess, email: parsed.data.email ?? null },
  }, 201)
})

members.put('/:id', requirePermission('update:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const { before } = await updateMember(db, id, parsed.data)

  await audit(db, {
    actor: getActor(c),
    action: 'update_member',
    entity: 'members',
    entityId: id,
    before,
    after: {
      name: parsed.data.name,
      role: parsed.data.role,
      nik: parsed.data.nik ?? null,
      phone: parsed.data.phone ?? null,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Member updated successfully' })
})

/**
 * Admin impersonation: short-lived member JWT to preview /portal as that member.
 * Does not require the member to have portal password set.
 */
members.post('/:id/impersonate', requirePermission('read:members'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const member = await getMemberForImpersonation(db, id)

  if (!member) {
    return c.json({ success: false, message: 'Anggota tidak ditemukan' }, 404)
  }

  const actor = getActor(c)
  const expSec = 15 * 60
  const payload = {
    sub: member.id,
    email: member.email || member.id,
    role: 'member',
    name: member.name,
    impersonatedBy: actor,
    preview: true,
    exp: Math.floor(Date.now() / 1000) + expSec,
  }
  const token = await sign(payload, secretKey)

  await audit(db, {
    actor,
    action: 'update_member',
    entity: 'members',
    entityId: id,
    after: { impersonationPreview: true, memberName: member.name },
    ip: getClientIp(c),
  })

  return c.json({
    success: true,
    data: {
      token,
      memberId: member.id,
      memberName: member.name,
      expiresIn: expSec,
    },
  })
})

/** Set email + password for member self-service portal (/portal) */
members.put('/:id/portal-access', requirePermission('update:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberPortalAccessSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const { before, after } = await setMemberPortalAccess(db, id, {
    email: parsed.data.email,
    password: parsed.data.password,
  })

  await audit(db, {
    actor: getActor(c),
    action: 'update_member',
    entity: 'members',
    entityId: id,
    before: { email: before.email, hasPortalAccess: before.hasPassword },
    after: { email: after.email, hasPortalAccess: after.hasPassword },
    ip: getClientIp(c),
  })

  return c.json({
    success: true,
    message: 'Akses portal anggota diperbarui',
    data: { email: after.email, hasPortalAccess: after.hasPassword },
  })
})

members.put('/:id/savings', requirePermission('update:savings'), async (c) => {
  const body = await c.req.json()
  const parsed = savingsSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const result = await updateMemberSavings(db, id, parsed.data, getActor(c))

  await audit(db, {
    actor: getActor(c),
    action: 'update_savings',
    entity: 'members',
    entityId: id,
    before: {
      simpananPokok: result.before.simpananPokok,
      simpananWajib: result.before.simpananWajib,
      simpananSukarela: result.before.simpananSukarela,
    },
    after: result.after,
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, data: { newTotal: result.newTotal } })
})

members.get('/:id/transactions', requirePermission('read:members'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const rows = await getMemberTransactions(db, id)
  return c.json({ success: true, data: rows })
})

// ---------------------------------------------------------------------------
// CSV Template Download
// ---------------------------------------------------------------------------

members.get('/template-csv', requirePermission('create:members'), async (c) => {
  const today = new Date().toISOString().split('T')[0]

  const lines = [
    'nik,nama,email,phone,alamat,tanggal_bergabung,simpanan_pokok,simpanan_wajib,simpanan_sukarela',
    `3171012345670001,Budi Santoso,budi@email.com,08123456789,Jl. Merdeka No. 1,${today},1000000,500000,0`,
    `3171012345670002,Siti Rahma,siti@email.com,08987654321,Jl. Pahlawan No. 5,${today},1000000,500000,250000`,
  ]

  const csvText = '\uFEFF' + lines.join('\r\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="Template_Import_Anggota_${today}.csv"`)
  return c.text(csvText)
})

// ---------------------------------------------------------------------------
// Batch Import Members
// ---------------------------------------------------------------------------

members.post('/batch-import', requirePermission('create:members'), async (c) => {
  const body = await c.req.json()
  const parsed = batchMemberImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportMembers(db, parsed.data.items, getActor(c))

  await audit(db, {
    actor: getActor(c),
    action: 'create_member',
    entity: 'members',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} data anggota${result.failedCount > 0 ? `, ${result.failedCount} gagal` : ''}`,
    data: result,
  })
})

export default members