import { Hono } from 'hono'
import db from '../db'
import { adminCreationSchema, adminUpdateSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { audit, getActor, getClientIp, getJwtPayload } from '../lib/audit'
import {
  getAdminsList,
  createAdmin,
  updateAdminRole,
  deleteAdmin,
  getSavingsReconciliationData,
  reconcileMemberSavings,
} from '../services/adminService'
import { mapServiceError } from '../lib/serviceResponse'

const admins = new Hono()

// Apply requirePermission('manage:users') to all routes in this router
admins.use('*', requirePermission('manage:users'))

// GET /api/v1/admins
admins.get('/', async (c) => {
  const rows = await getAdminsList(db)
  return c.json({ success: true, data: rows })
})

// POST /api/v1/admins
admins.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = adminCreationSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const id = await createAdmin(db, parsed.data)

    // Audit: log admin creation
    await audit(db, {
      actor: getActor(c),
      action: 'create_admin',
      entity: 'admins',
      entityId: id,
      after: { email: parsed.data.email, role: parsed.data.role, name: parsed.data.name },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Pengurus berhasil ditambahkan', id }, 201)
  } catch (error) {
    const res = mapServiceError(c, error)
    if (res) return res
    throw error
  }
})

// PUT /api/v1/admins/:id
admins.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = adminUpdateSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { role } = parsed.data
    const currentUserPayload = getJwtPayload(c)
    
    // Prevent self-role modification to avoid locking oneself out of superadmin
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat mengubah peran Anda sendiri' }, 400)
    }
    
    const before = await updateAdminRole(db, id, role)

    // Audit: log admin role update
    await audit(db, {
      actor: getActor(c),
      action: 'update_admin',
      entity: 'admins',
      entityId: id,
      before: before ? { role: before.role } : undefined,
      after: { role },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Peran pengurus berhasil diperbarui' })
  } catch (error) {
    const res = mapServiceError(c, error)
    if (res) return res
    throw error
  }
})

// DELETE /api/v1/admins/:id
admins.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const currentUserPayload = getJwtPayload(c)

    // Prevent self-deletion
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri' }, 400)
    }

    const before = await deleteAdmin(db, id)

    // Audit: log admin deletion
    if (before) {
      await audit(db, {
        actor: getActor(c),
        action: 'delete_admin',
        entity: 'admins',
        entityId: id,
        before: { email: before.email, role: before.role },
        ip: getClientIp(c),
      })
    }

    return c.json({ success: true, message: 'Pengurus berhasil dihapus' })
  } catch (error) {
    const res = mapServiceError(c, error)
    if (res) return res
    throw error
  }
})

// GET /api/v1/admins/reconcile-savings - Admin endpoint to detect savings balance drift
admins.get('/reconcile-savings', async (c) => {
  try {
    const { reconciliationResults, negativeBalanceMembers } = await getSavingsReconciliationData(db)

    return c.json({
      success: true,
      data: {
        reconciliationResults,
        negativeBalanceMembers,
        summary: {
          totalDrifted: reconciliationResults.length,
          totalNegativeBalances: negativeBalanceMembers.length,
          totalIssues: reconciliationResults.length + negativeBalanceMembers.length
        }
      }
    })
  } catch (error) {
    throw error
  }
})

// POST /api/v1/admins/reconcile-savings - Admin endpoint to fix savings balance drift
admins.post('/reconcile-savings', async (c) => {
  try {
    const { memberId } = await c.req.json()

    if (!memberId) {
      return c.json({ success: false, message: 'memberId is required' }, 400)
    }

    const { member, correctTotal } = await reconcileMemberSavings(db, memberId)

    // Audit: log savings reconciliation
    await audit(db, {
      actor: getActor(c),
      action: 'update_savings',
      entity: 'members',
      entityId: memberId,
      before: { totalSavings: Number(member.totalSavings) },
      after: { totalSavings: correctTotal, reconciledBy: getActor(c) },
      ip: getClientIp(c),
    })

    return c.json({
      success: true,
      message: `Balance reconciled for ${member.name}`,
      data: {
        memberId: member.id,
        previousTotal: Number(member.totalSavings),
        correctedTotal: correctTotal
      }
    })
  } catch (error) {
    const res = mapServiceError(c, error)
    if (res) return res
    throw error
  }
})

export default admins
