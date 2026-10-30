import { Hono } from 'hono';
import db from '../db';
import { requirePermission } from '../middleware';
import { getActor, getClientIp, audit } from '../lib/audit';
import { notifyEwaDisbursed } from '../services/waNotificationService';
import {
  getEwaRequestsList,
  disburseEwa,
  rejectEwa,
  getPayrollRecap,
  settlePayroll,
  batchImportEmployees,
  getEwaFeeTiers,
  saveEwaFeeTiers,
  calculateEwaFee,
  getEwaPaymentSources,
  getEwaEmployeesList,
} from '../services/ewaService';
import {
  ewaEmployeeSchema,
  batchEwaEmployeeImportSchema,
  ewaDisburseSchema,
  ewaRejectSchema,
  ewaPayrollSettleSchema,
  saveEwaFeeTiersSchema,
} from '../schemas';

const ewa = new Hono();

// ---------------------------------------------------------------------------
// EWA Requests Management
// ---------------------------------------------------------------------------

// 1. List EWA Requests
ewa.get('/requests', requirePermission('read:loans'), async (c) => {
  const employeeId = c.req.query('employeeId');
  const periodMonth = c.req.query('periodMonth');
  const status = c.req.query('status');
  const search = c.req.query('search') || c.req.query('q');
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);

  const result = await getEwaRequestsList(db, {
    employeeId,
    periodMonth,
    status,
    search,
    page,
    limit,
  });

  return c.json({ success: true, ...result });
});

// 1.1 Get Available Payment Sources (Cash/Bank accounts) for EWA Disbursement
ewa.get('/payment-sources', requirePermission('approve:loans'), async (c) => {
  const accounts = await getEwaPaymentSources(db);
  return c.json({ success: true, data: accounts });
});

// 2. Disburse EWA Request
ewa.post('/requests/:id/disburse', requirePermission('approve:loans'), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, message: 'ID permintaan EWA diperlukan' }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = ewaDisburseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c) || 'admin';
  try {
    const disbursed = await disburseEwa(db, id, actor, parsed.data.paymentSourceAccountId);

    await audit(db, {
      actor,
      action: 'disburse_ewa' as any,
      entity: 'ewa_requests',
      entityId: id,
      after: {
        amountRequested: disbursed.amountRequested,
        disbursedAmount: disbursed.disbursedAmount,
        feeAmount: disbursed.feeAmount,
        status: disbursed.status,
      },
      ip: getClientIp(c),
    });

    notifyEwaDisbursed({
      memberName: disbursed.employeeName || 'Karyawan',
      memberCode: disbursed.employeeNip || undefined,
      amountRequested: Number(disbursed.amountRequested),
      feeAmount: Number(disbursed.feeAmount || 0),
      disbursedAmount: Number(disbursed.disbursedAmount),
      destinationBank: disbursed.destinationBank || undefined,
      destinationAccount: disbursed.destinationAccount || undefined,
      destinationName: disbursed.destinationName || undefined,
      processedBy: actor,
      db,
    });

    return c.json({
      success: true,
      message: `Dana EWA sebesar Rp ${disbursed.disbursedAmount.toLocaleString('id-ID')} berhasil dicairkan!`,
      data: disbursed,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mencairkan EWA' }, 400);
  }
});

// 3. Reject EWA Request
ewa.post('/requests/:id/reject', requirePermission('approve:loans'), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, message: 'ID permintaan EWA diperlukan' }, 400);
  }
  const body = await c.req.json();
  const parsed = ewaRejectSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c) || 'admin';
  try {
    const rejected = await rejectEwa(db, id, actor, parsed.data.reason);

    await audit(db, {
      actor,
      action: 'reject_ewa' as any,
      entity: 'ewa_requests',
      entityId: id,
      after: {
        reason: parsed.data.reason,
        status: rejected.status,
      },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: 'Permohonan EWA telah ditolak',
      data: rejected,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menolak EWA' }, 400);
  }
});

// ---------------------------------------------------------------------------
// Company Employees Management
// ---------------------------------------------------------------------------

// 4. List Company Employees
ewa.get('/employees', requirePermission('approve:loans'), async (c) => {
  const search = c.req.query('search') || '';
  const status = c.req.query('status') || '';
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);
  const offset = (page - 1) * limit;

  const { items, total } = await getEwaEmployeesList(db, {
    search,
    status,
    limit,
    offset,
  });

  return c.json({
    success: true,
    data: items,
    total,
    page,
    limit,
  });
});

// 5. Create / Upsert Single Employee
ewa.post('/employees', requirePermission('create:members'), async (c) => {
  const body = await c.req.json();
  const parsed = ewaEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  const result = await batchImportEmployees(db, [parsed.data as any]);

  if (result.errors.length > 0) {
    return c.json({ success: false, message: result.errors[0].message }, 400);
  }

  await audit(db, {
    actor,
    action: 'create_company_employee' as any,
    entity: 'company_employees',
    after: parsed.data,
    ip: getClientIp(c),
  });

  return c.json(
    {
      success: true,
      message: 'Data karyawan berhasil disimpan',
      data: parsed.data,
    },
    201
  );
});

// 6. Batch Import Employees (CSV/Excel)
ewa.post('/employees/batch-import', requirePermission('create:members'), async (c) => {
  const body = await c.req.json();
  const parsed = batchEwaEmployeeImportSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  const result = await batchImportEmployees(db, parsed.data.items);

  await audit(db, {
    actor,
    action: 'import_company_employees' as any,
    entity: 'company_employees',
    after: { processedCount: result.processedCount, failedCount: result.errors.length },
    ip: getClientIp(c),
  });

  return c.json({
    success: true,
    message: `Berhasil memproses ${result.processedCount} data karyawan perusahaan`,
    data: result,
  });
});

// ---------------------------------------------------------------------------
// Payroll Deduction Recap & Settlement (HRD)
// ---------------------------------------------------------------------------

// 6. Get Payroll Deduction Recap
ewa.get('/payroll/recap', requirePermission('read:reports'), async (c) => {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodMonth = c.req.query('periodMonth') || currentPeriod;

  try {
    const recap = await getPayrollRecap(db, periodMonth);
    return c.json({ success: true, data: recap });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat rekap payroll' }, 400);
  }
});

// 7. Settle Payroll Deductions from Parent Company
ewa.post('/payroll/settle', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json();
  const parsed = ewaPayrollSettleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  try {
    const result = await settlePayroll(
      db,
      parsed.data.periodMonth,
      actor,
      parsed.data.targetAccountId,
      parsed.data.transactionDate
    );

    await audit(db, {
      actor,
      action: 'settle_ewa_payroll' as any,
      entity: 'ewa_requests',
      after: {
        periodMonth: parsed.data.periodMonth,
        settledCount: result.settledCount,
        totalSettledAmount: result.totalSettledAmount,
      },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: `Pelunasan payroll periode ${parsed.data.periodMonth} berhasil dibukukan! Total: Rp ${result.totalSettledAmount.toLocaleString('id-ID')}`,
      data: result,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memproses pelunasan payroll' }, 400);
  }
});

// ---------------------------------------------------------------------------
// Fee Tiers Management
// ---------------------------------------------------------------------------

// 8. Get Fee Tiers
ewa.get('/fee-tiers', async (c) => {
  try {
    const tiers = await getEwaFeeTiers(db);
    return c.json({ success: true, data: tiers });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat tabel tarif biaya admin' }, 500);
  }
});

// 9. Update/Save Fee Tiers (Admin)
ewa.put('/fee-tiers', requirePermission('update:settings'), async (c) => {
  const body = await c.req.json();
  const parsed = saveEwaFeeTiersSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  try {
    const beforeTiers = await getEwaFeeTiers(db);
    const updated = await saveEwaFeeTiers(db, parsed.data.tiers as any);

    await audit(db, {
      actor,
      action: 'update_ewa_fee_tiers' as any,
      entity: 'ewa_fee_tiers',
      before: { count: beforeTiers.length, tiers: beforeTiers },
      after: { count: updated.length, tiers: updated },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: 'Tabel tarif biaya admin EWA berhasil disimpan!',
      data: updated,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menyimpan tabel tarif' }, 400);
  }
});

// 10. Calculate Fee Real-Time Preview
ewa.post('/calculate-fee', async (c) => {
  try {
    const body = await c.req.json();
    const amount = Number(body.amount || 0);
    const isMember = Boolean(body.isMember);

    const calc = await calculateEwaFee(db, amount, isMember);
    return c.json({
      success: true,
      data: {
        amount,
        isMember,
        feeAmount: calc.feeAmount,
        feePercentage: calc.feePercentage,
        disbursedAmount: amount,
        totalPayrollDeduction: amount + calc.feeAmount,
        tier: calc.tier,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menghitung biaya admin' }, 400);
  }
});

export default ewa;
