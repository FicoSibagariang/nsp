import { Hono } from 'hono'
import db from '../db'
import { settingsSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'
import { sendWaTestMessage } from '../services/waNotificationService'
import {
  getPublicBranding,
  getAllSettings,
  updateAllSettings,
} from '../services/settingsService'

const settings = new Hono()

/** Public branding fields only (safe for login page / unauthenticated UI). */
settings.get('/branding', async (c) => {
  const data = await getPublicBranding(db)
  return c.json({
    success: true,
    data,
  })
})

settings.get('/', requirePermission('read:settings'), async (c) => {
  const settingsObj = await getAllSettings(db)
  return c.json({ success: true, data: settingsObj })
})

settings.post('/test-wa', requirePermission('update:settings'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = await sendWaTestMessage({
    db,
    target: body.target,
    webhookUrl: body.webhookUrl,
    token: body.token,
  });
  return c.json(result, result.success ? 200 : 400);
})

settings.put('/', requirePermission('update:settings'), async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { beforeMap, afterMap } = await updateAllSettings(db, parsed.data)

    // Audit: log settings update
    await audit(db, {
      actor: getActor(c),
      action: 'update_settings',
      entity: 'settings',
      entityId: null,
      before: beforeMap,
      after: afterMap,
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true })
  } catch (error) {
    throw error
  }
})

export default settings
