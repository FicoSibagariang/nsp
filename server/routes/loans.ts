import { Hono } from 'hono'
import * as XLSX from 'xlsx'
import db from '../db'
import type { LoanPaymentRow, LoanRow } from '../db/entities'
import {
  loanDisbursementDateSchema,
  loanSchema,
  loanScheduleRegenerateSchema,
  loanScheduleReplaceSchema,
  loanStatusSchema,
  paymentSchema,
  paymentUpdateSchema,
} from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  createLoan,
  deleteLoan,
  deleteLoanPayment,
  enrichLoanForList,
  getBungaRatePercent,
  getLoanSchedule,
  recordLoanPayment,
  regenerateLoanInstallmentSchedule,
  replaceLoanInstallmentSchedule,
  updateLoanDisbursementDate,
  updateLoanPayment,
  updateLoanStatus,
  batchImportLoans,
  batchImportPayments,
  batchImportSchedules,
  getLoansList,
  getLoanPaymentSources,
  getLoanPayrollDeductions,
  getLoanPaymentsLedger,
  getLoanPaymentsByLoanId,
} from '../services/loanService'
import { requireRouteParam } from '../lib/serviceResponse'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'
import { batchLoanImportSchema, batchPaymentImportSchema, batchScheduleImportSchema } from '../schemas'

const loans = new Hono()

loans.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const fetchAll = c.req.query('all') === 'true'

  const { data: mappedLoans, total } = await getLoansList(db, {
    page,
    limit,
    includeArchived: c.req.query('includeArchived') === 'true',
    search: c.req.query('search')?.trim(),
    status: c.req.query('status')?.trim(),
    fetchAll,
  })

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total,
      page,
      limit
    }
  })
})

loans.post('/', requirePermission('create:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const { id } = await createLoan(db, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'create_loan',
      entity: 'loans',
      entityId: id,
      after: {
        memberId: parsed.data.memberId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        tenor: parsed.data.tenor,
        purpose: parsed.data.purpose,
        status: parsed.data.status,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
})

// Get Available Payment Sources (Cash/Bank accounts) for Loan Disbursement
loans.get('/payment-sources', requirePermission('approve:loans'), async (c) => {
  const accounts = await getLoanPaymentSources(db);
  return c.json({ success: true, data: accounts });
});

loans.put('/:id/status', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanStatusSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const { status, approvedDate, interestRate, paymentSourceAccountId, firstInstallmentDate, rejectionReason } = parsed.data
  const { before } = await updateLoanStatus(db, id, status, {
    approvedDate,
    interestRate,
    paymentSourceAccountId,
    firstInstallmentDate,
    rejectionReason: rejectionReason ?? undefined,
  })

  const action = status === 'Disetujui' ? 'approve_loan' : 'reject_loan'
  await audit(db, {
    actor: getActor(c),
    action,
    entity: 'loans',
    entityId: id,
    before: before ? { status: before.status } : undefined,
    after: {
      status,
      approvedDate: approvedDate ?? null,
      interestRate: interestRate ?? null,
      paymentSourceAccountId: paymentSourceAccountId ?? null,
      firstInstallmentDate: firstInstallmentDate ?? null,
      rejectionReason: rejectionReason ?? null,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Loan status updated' })
})

loans.put('/:id/disbursement-date', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanDisbursementDateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const { before, after } = await updateLoanDisbursementDate(db, id, parsed.data.disbursementDate)

  await audit(db, {
    actor: getActor(c),
    action: 'update_loan_disbursement',
    entity: 'loans',
    entityId: id,
    before,
    after,
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Tanggal pencairan diperbarui', data: after })
})

// Get Monthly Loan Installment Payroll Deductions for HRIS Export
loans.get('/payroll-deductions', requirePermission('read:loans'), async (c) => {
  const monthParam = c.req.query('month');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(year, m, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const rows = await getLoanPayrollDeductions(db, startDate, endDate);

  const items = rows.map((r: any) => ({
    employeeId: r.employeeId || '',
    name: r.name,
    memberId: r.memberId,
    loanCount: Number(r.loanCount || 1),
    amount: Math.round(Number(r.amount || 0)),
    principalAmount: Math.round(Number(r.principalAmount || 0)),
    interestAmount: Math.round(Number(r.interestAmount || 0)),
    currentAmount: 0,
    newAmount: Math.round(Number(r.amount || 0)),
    note: '',
  }));

  const totalEmployees = items.length;
  const totalAmount = items.reduce((sum: number, it: any) => sum + it.amount, 0);

  const formatParam = c.req.query('format')?.toLowerCase();
  const acceptHeader = c.req.header('accept') || '';
  const wantsXlsx = formatParam === 'xlsx' || acceptHeader.includes('application/vnd.openxmlformats');

  if (wantsXlsx) {
    const rows: (string | number)[][] = [
      ['Employee ID', 'Name', 'Current Amount', 'New Amount', 'Note'],
    ];

    for (const it of items) {
      rows.push([
        it.employeeId ? String(it.employeeId) : '',
        it.name || '',
        it.currentAmount ?? 0,
        Number(it.newAmount || 0),
        it.note ?? '',
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Potong Gaji Angsuran');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const indonesianMonths = [
      'januari', 'februari', 'maret', 'april', 'mei', 'juni',
      'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
    ];
    const monthName = indonesianMonths[(m - 1) % 12] || monthStr;
    const filename = `potong_gaji_angsuran_${monthName}_${yearStr}.xlsx`;

    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(buf);
  }

  return c.json({
    success: true,
    data: {
      month,
      startDate,
      endDate,
      totalEmployees,
      totalAmount,
      items,
    },
  });
});

loans.get('/payments', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const { rows, total } = await getLoanPaymentsLedger(db, limit, offset)

  return c.json({
    success: true,
    data: {
      data: rows,
      total,
      page,
      limit
    }
  })
})

loans.get('/:id/schedule', requirePermission('read:loans'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const schedule = await getLoanSchedule(db, id)
  return c.json({ success: true, data: schedule })
})

loans.post('/:id/schedule/regenerate', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanScheduleRegenerateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const result = await regenerateLoanInstallmentSchedule(db, id, {
    interestRate: parsed.data.interestRate,
  })

  await audit(db, {
    actor: getActor(c),
    action: 'regenerate_loan_schedule',
    entity: 'loans',
    entityId: id,
    after: {
      scheduleRegenerated: true,
      interestRate: result.interestRate,
      monthlyPayment: result.monthlyPayment,
      totalAmount: result.totalAmount,
      rows: result.rows,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({
    success: true,
    message: 'Jadwal angsuran di-generate ulang',
    data: result,
  })
})

loans.put('/:id/schedule', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanScheduleReplaceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const id = requireRouteParam(c, 'id')
  const result = await replaceLoanInstallmentSchedule(db, id, parsed.data.rows)

  await audit(db, {
    actor: getActor(c),
    action: 'replace_loan_schedule',
    entity: 'loans',
    entityId: id,
    after: {
      scheduleManualReplace: true,
      rows: result.rows,
      totalAmount: result.totalAmount,
      interestAmount: result.interestAmount,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({
    success: true,
    message: 'Jadwal angsuran disimpan',
    data: result,
  })
})

loans.get('/:id/payments', requirePermission('read:loans'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const payments = await getLoanPaymentsByLoanId(db, id)
  return c.json({ success: true, data: payments })
})

loans.post('/:id/payments', requirePermission('create:payments'), async (c) => {
  const body = await c.req.json()
  const parsed = paymentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const loanId = requireRouteParam(c, 'id')
  const { id } = await recordLoanPayment(db, loanId, parsed.data)

  await audit(db, {
    actor: getActor(c),
    action: 'create_payment',
    entity: 'loan_payments',
    entityId: id,
    after: { loanId, amount: parsed.data.amount, method: parsed.data.method },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
})

loans.put('/:id/payments/:paymentId', requirePermission('create:payments'), async (c) => {
  const body = await c.req.json()
  const parsed = paymentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const loanId = requireRouteParam(c, 'id')
  const paymentId = requireRouteParam(c, 'paymentId')
  const { before, after } = await updateLoanPayment(db, loanId, paymentId, parsed.data)

  await audit(db, {
    actor: getActor(c),
    action: 'update_payment',
    entity: 'loan_payments',
    entityId: paymentId,
    before: {
      amount: before.amount,
      paymentDate: before.paymentDate,
      method: before.method,
    },
    after: {
      amount: after.amount,
      paymentDate: after.paymentDate,
      method: after.method,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Payment updated successfully', data: after })
})

loans.delete('/:id/payments/:paymentId', requirePermission('create:payments'), async (c) => {
  const loanId = requireRouteParam(c, 'id')
  const paymentId = requireRouteParam(c, 'paymentId')
  const { before } = await deleteLoanPayment(db, loanId, paymentId)

  await audit(db, {
    actor: getActor(c),
    action: 'delete_payment',
    entity: 'loan_payments',
    entityId: paymentId,
    before: {
      loanId: before.loanId,
      amount: before.amount,
      paymentDate: before.paymentDate,
      method: before.method,
    },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Payment deleted successfully' })
})

loans.delete('/:id', requirePermission('delete:loans'), async (c) => {
  const id = requireRouteParam(c, 'id')
  await deleteLoan(db, id)

  await audit(db, {
    actor: getActor(c),
    action: 'archive_loan',
    entity: 'loans',
    entityId: id,
    after: { deletedAt: new Date().toISOString() },
    ip: getClientIp(c),
  })

  clearStatsCache()
  return c.json({ success: true, message: 'Loan archived successfully' })
})

// ---------------------------------------------------------------------------
// CSV Template Download
// ---------------------------------------------------------------------------

loans.get('/template-csv', requirePermission('create:loans'), async (c) => {
  const today = new Date().toISOString().split('T')[0]
  const lines = [
    'nik,nama_pinjaman,jumlah,tenor,tujuan,tanggal_pinjaman,bunga',
    `3171012345670001,Pinjaman Modal Usaha,5000000,12,Modal usaha warung,${today},`,
    `3171012345670002,Pinjaman Konsumtif,3000000,6,Kebutuhan rumah tangga,${today},`,
  ]
  const csvText = '\uFEFF' + lines.join('\r\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="Template_Import_Pinjaman_${today}.csv"`)
  return c.text(csvText)
})

// ---------------------------------------------------------------------------
// Batch Import Loans
// ---------------------------------------------------------------------------

loans.post('/batch-import', requirePermission('create:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = batchLoanImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportLoans(db, parsed.data.items)

  await audit(db, {
    actor: getActor(c),
    action: 'create_loan',
    entity: 'loans',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} pinjaman${result.failedCount > 0 ? `, ${result.failedCount} gagal` : ''}`,
    data: result,
  })
})

// ---------------------------------------------------------------------------
// CSV Template - Angsuran
// ---------------------------------------------------------------------------

loans.get('/payments/template-csv', requirePermission('create:payments'), async (c) => {
  const today = new Date().toISOString().split('T')[0]
  const lines = [
    'nik,loan_id,jumlah,metode,tanggal',
    `3171012345670001,,500000,Transfer,${today}`,
    `3171012345670002,,300000,Cash,${today}`,
  ]
  const csvText = '\uFEFF' + lines.join('\r\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="Template_Import_Angsuran_${today}.csv"`)
  return c.text(csvText)
})

// ---------------------------------------------------------------------------
// Batch Import Angsuran
// ---------------------------------------------------------------------------

loans.post('/payments/batch-import', requirePermission('create:payments'), async (c) => {
  const body = await c.req.json()
  const parsed = batchPaymentImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportPayments(db, parsed.data.items)

  await audit(db, {
    actor: getActor(c),
    action: 'create_payment',
    entity: 'loan_payments',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} angsuran${result.failedCount > 0 ? `, ${result.failedCount} gagal` : ''}`,
    data: result,
  })
})

// ---------------------------------------------------------------------------
// CSV Template - Jadwal Angsuran
// ---------------------------------------------------------------------------

loans.get('/schedules/template-csv', requirePermission('approve:loans'), async (c) => {
  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const d1 = today.toISOString().split('T')[0]
  const d2 = nextMonth.toISOString().split('T')[0]
  
  const lines = [
    'loan_id,cicilan_ke,tanggal_jatuh_tempo,pokok,bunga',
    `contoh-id-pinjaman-123,1,${d1},416667,100000`,
    `contoh-id-pinjaman-123,2,${d2},416667,100000`,
  ]
  const csvText = '\uFEFF' + lines.join('\r\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="Template_Import_Jadwal.csv"`)
  return c.text(csvText)
})

// ---------------------------------------------------------------------------
// Batch Import Jadwal Angsuran
// ---------------------------------------------------------------------------

loans.post('/schedules/batch-import', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = batchScheduleImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportSchedules(db, parsed.data.items)

  await audit(db, {
    actor: getActor(c),
    action: 'replace_loan_schedule',
    entity: 'loan_schedules',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} baris jadwal${result.failedCount > 0 ? `, ${result.failedCount} grup pinjaman gagal` : ''}`,
    data: result,
  })
})

export default loans