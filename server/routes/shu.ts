import { Hono } from 'hono'
import {
  calculateSHU,
  getShuConfig,
  saveShuConfig,
  closeShuPeriod,
  reopenShuPeriod,
} from '../services/shuService'
import { requirePermission } from '../middleware'
import db from '../db'
import { audit, getActor, getClientIp } from '../lib/audit'
import { shuConfigSchema } from '../schemas'

const shu = new Hono()

// ---------------------------------------------------------------------------
// GET /api/v1/shu — Get SHU data for a year (closed or dynamic)
// ---------------------------------------------------------------------------
shu.get('/', requirePermission('read:shu'), async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const mode = c.req.query('mode') === 'projection' ? 'projection' : 'realization';
  const data = await calculateSHU(year, { mode });
  return c.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// GET /api/v1/shu/config — Get current SHU distribution configuration
// ---------------------------------------------------------------------------
shu.get('/config', requirePermission('read:settings'), async (c) => {
  const config = await getShuConfig();
  return c.json({ success: true, data: config });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/shu/config — Update SHU distribution configuration
// ---------------------------------------------------------------------------
shu.put('/config', requirePermission('update:settings'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = shuConfigSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Konfigurasi tidak valid';
    return c.json({ success: false, message: errorMsg, errors: parsed.error.format() }, 400);
  }

  const { cadanganPct, anggotaPct, pengurusPct, sosialPct, pembangunanPct, jasaSimpananPct, jasaPinjamanPct, includeInactiveMembers } = parsed.data;

  const updates: Record<string, string> = {
    shu_cadangan_pct: cadanganPct.toString(),
    shu_anggota_pct: anggotaPct.toString(),
    shu_pengurus_pct: pengurusPct.toString(),
    shu_sosial_pct: sosialPct.toString(),
    shu_pembangunan_pct: pembangunanPct.toString(),
    shu_jasa_simpanan_pct: jasaSimpananPct.toString(),
    shu_jasa_pinjaman_pct: jasaPinjamanPct.toString(),
    shu_include_inactive_members: (includeInactiveMembers ?? true).toString(),
  };

  await saveShuConfig(db, updates);

  await audit(db, {
    actor: getActor(c),
    action: 'update_settings',
    entity: 'settings',
    entityId: 'shu_config',
    after: updates,
    ip: getClientIp(c),
  });

  return c.json({ success: true, message: 'Konfigurasi alokasi SHU berhasil disimpan' });
});

// ---------------------------------------------------------------------------
// POST /api/v1/shu/close — Close (lock) a fiscal year
// Only admin role can close a period.
// ---------------------------------------------------------------------------
shu.post('/close', requirePermission('approve:loans'), async (c) => {
  const { year, biayaOperasional } = await c.req.json();
  if (!year) return c.json({ success: false, message: 'Tahun wajib diisi' }, 400);

  try {
    const userEmail = getActor(c);
    const { pendapatan, shuNetto } = await closeShuPeriod(db, year, userEmail, biayaOperasional);

    // Audit: log SHU year close
    await audit(db, {
      actor: getActor(c),
      action: 'close_shu',
      entity: 'shu_closes',
      entityId: year,
      after: { year, pendapatan, shuNetto },
      ip: getClientIp(c),
    });

    return c.json({ success: true, message: `Tahun Buku ${year} berhasil ditutup` });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return c.json({ success: false, message: err.message }, status);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/shu/reopen — Reopen (unlock) a previously closed fiscal year
// Only superadmin can reopen. Uses 'delete:members' as the audit-sensitive
// permission gate since no dedicated shu:reopen permission exists yet.
// ---------------------------------------------------------------------------
shu.post('/reopen', requirePermission('delete:members'), async (c) => {
  const { year } = await c.req.json();
  if (!year) return c.json({ success: false, message: 'Tahun wajib diisi' }, 400);

  try {
    const beforeClose = await reopenShuPeriod(db, year);

    // Audit: log SHU year reopen
    if (beforeClose) {
      await audit(db, {
        actor: getActor(c),
        action: 'reopen_shu',
        entity: 'shu_closes',
        entityId: year,
        before: { year: beforeClose.year, pendapatan: beforeClose.pendapatan, shuNetto: beforeClose.shuNetto },
        ip: getClientIp(c),
      });
    }

    return c.json({ success: true, message: `Tahun Buku ${year} berhasil dibuka kembali` });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return c.json({ success: false, message: err.message }, status);
  }
});

export default shu;
