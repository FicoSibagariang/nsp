import { Hono } from 'hono';
import db from '../db';
import type { JwtPayload } from '../types/auth';
import {
  getEmployeeByEmail,
  getEmployeeById,
  getEmployeeEwaQuota,
  createEwaRequest,
  getEwaRequestsList,
  getEwaFeeTiers,
} from '../services/ewaService';
import {
  ewaRequestCreateSchema,
  savingsWithdrawalCreateSchema,
  savingsDepositCreateSchema,
} from '../schemas';
import {
  getMemberWithdrawals,
  createSavingsWithdrawalRequest,
} from '../services/savingsWithdrawalService';
import {
  getMemberDeposits,
  createSavingsDepositRequest,
} from '../services/savingsDepositService';
import {
  notifyEwaRequest,
  notifySavingsWithdrawal,
  notifySavingsDeposit,
  notifyLoanApplication,
} from '../services/waNotificationService';
import {
  findEmployeeIdByMemberId,
  getMemberPortalProfile,
  getMemberSavingsTransactions,
  getMemberNameAndNik,
  getMemberLoans,
  getMemberLoanSchedule,
  getMemberLoanPayments,
  applyMemberLoan,
  getMemberIncomeStatement,
  getMemberBalanceSheet,
  getMemberCashflowStatement,
  getMemberShuPortal,
} from '../services/memberPortalService';

const memberSelfService = new Hono();

// Middleware to ensure route is only accessed by a member
memberSelfService.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined;
  if (!payload || payload.role !== 'member') {
    return c.json({ success: false, message: 'Unauthorized, member access only' }, 401);
  }
  return next();
});

// Get member / employee profile and savings summary
memberSelfService.get('/profile', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const memberId = payload.sub;
  const email = payload.email;

  const profileData = await getMemberPortalProfile(db, memberId, email);

  if (!profileData) {
    return c.json({ success: false, message: 'Data pengguna tidak ditemukan' }, 404);
  }

  return c.json({
    success: true,
    data: profileData,
  });
});

// ---------------------------------------------------------------------------
// EWA (Earned Wage Access) Member Endpoints
// ---------------------------------------------------------------------------

// 1. Get EWA Quota for logged-in employee / member
memberSelfService.get('/ewa/quota', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empId = await findEmployeeIdByMemberId(db, payload.sub);
    if (empId) {
      employee = await getEmployeeById(db, empId);
    }
  }

  if (!employee) {
    return c.json({
      success: false,
      message: 'Data karyawan perusahaan tidak ditemukan. Layanan EWA hanya berlaku untuk karyawan perusahaan induk terdaftar.',
    }, 404);
  }

  try {
    const quota = await getEmployeeEwaQuota(db, employee.id);
    const feeTiers = await getEwaFeeTiers(db);
    return c.json({
      success: true,
      data: {
        ...quota,
        employee,
        feeTiers,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat kuota EWA' }, 400);
  }
});

// 2. Get Fee Tiers
memberSelfService.get('/ewa/fee-tiers', async (c) => {
  try {
    const tiers = await getEwaFeeTiers(db);
    return c.json({ success: true, data: tiers });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat tabel tarif' }, 500);
  }
});

// 3. Get EWA History
memberSelfService.get('/ewa/history', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empId = await findEmployeeIdByMemberId(db, payload.sub);
    if (empId) {
      employee = await getEmployeeById(db, empId);
    }
  }

  if (!employee) {
    return c.json({ success: true, data: [] });
  }

  const list = await getEwaRequestsList(db, { employeeId: employee.id, limit: 50 });
  return c.json({ success: true, data: list.data });
});

// 4. Submit EWA Request
memberSelfService.post('/ewa/request', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empId = await findEmployeeIdByMemberId(db, payload.sub);
    if (empId) {
      employee = await getEmployeeById(db, empId);
    }
  }

  if (!employee) {
    return c.json({
      success: false,
      message: 'Data karyawan perusahaan tidak ditemukan. Layanan EWA hanya berlaku untuk karyawan perusahaan induk terdaftar.',
    }, 404);
  }

  const body = await c.req.json();
  const parsed = ewaRequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  try {
    const result = await createEwaRequest(db, employee.id, parsed.data);

    notifyEwaRequest({
      memberName: employee.name,
      memberCode: employee.nip || undefined,
      amount: result.amountRequested,
      db,
    });

    return c.json({
      success: true,
      message: 'Pengajuan penarikan EWA berhasil dikirim! Menunggu proses pencairan oleh bagian kasir/keuangan.',
      data: result,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mengajukan EWA' }, 400);
  }
});

// Get savings mutations
memberSelfService.get('/savings/transactions', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const transactions = await getMemberSavingsTransactions(db, memberId);
  return c.json({ success: true, data: transactions });
});

// Get voluntary savings withdrawal requests history for logged-in member
memberSelfService.get('/savings/withdrawals', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const withdrawals = await getMemberWithdrawals(db, memberId);
  return c.json({ success: true, data: withdrawals });
});

// Submit a new voluntary savings withdrawal request
memberSelfService.post('/savings/withdraw', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const body = await c.req.json().catch(() => ({}));
  const parsed = savingsWithdrawalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  try {
    const result = await createSavingsWithdrawalRequest(db, memberId, parsed.data);

    const member = await getMemberNameAndNik(db, memberId);
    await notifySavingsWithdrawal({
      memberName: member?.name || 'Anggota',
      memberCode: member?.nik || undefined,
      amount: parsed.data.amount,
      db,
    });

    return c.json({
      success: true,
      message: 'Permohonan penarikan simpanan sukarela berhasil dikirim! Menunggu persetujuan pengurus/bendahara.',
      data: result,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mengajukan penarikan simpanan sukarela' }, 400);
  }
});

// Get savings deposit confirmations history for logged-in member
memberSelfService.get('/savings/deposits', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const deposits = await getMemberDeposits(db, memberId);
  return c.json({ success: true, data: deposits });
});

// Submit a new savings deposit confirmation (transfer to coop Bank Mandiri account)
memberSelfService.post('/savings/deposit', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const body = await c.req.json().catch(() => ({}));
  const parsed = savingsDepositCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  try {
    const result = await createSavingsDepositRequest(db, memberId, parsed.data);

    const member = await getMemberNameAndNik(db, memberId);
    notifySavingsDeposit({
      memberName: member?.name || 'Anggota',
      amount: parsed.data.amount,
      db,
    });

    return c.json({
      success: true,
      message: 'Konfirmasi setoran simpanan berhasil dikirim! Menunggu verifikasi bendahara/pengurus.',
      data: result,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mengirim konfirmasi setoran simpanan' }, 400);
  }
});

// Get member loans
memberSelfService.get('/loans', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const loans = await getMemberLoans(db, memberId);
  return c.json({ success: true, data: loans });
});

// Get loan schedule for a specific loan
memberSelfService.get('/loans/:loanId/schedule', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;
  const loanId = c.req.param('loanId');

  const schedule = await getMemberLoanSchedule(db, loanId, memberId);
  if (!schedule) {
    return c.json({ success: false, message: 'Loan not found or unauthorized' }, 404);
  }

  return c.json({ success: true, data: schedule });
});

// Get payment history for a specific loan
memberSelfService.get('/loans/:loanId/payments', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;
  const loanId = c.req.param('loanId');

  const payments = await getMemberLoanPayments(db, loanId, memberId);
  if (!payments) {
    return c.json({ success: false, message: 'Loan not found or unauthorized' }, 404);
  }

  return c.json({ success: true, data: payments });
});

// Submit new loan application by member (accessible via /loans/apply and /loans)
const handleLoanApplication = async (c: any) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const body = await c.req.json();
  const amount = Number(body.amount);
  const tenor = Number(body.tenor);
  const purpose = String(body.purpose || '').trim();
  const attachmentUrl = body.attachmentUrl ? String(body.attachmentUrl).trim() : null;
  const attachmentName = body.attachmentName ? String(body.attachmentName).trim() : null;

  if (!amount || isNaN(amount) || amount <= 0) {
    return c.json({ success: false, message: 'Nominal pinjaman harus lebih dari 0' }, 400);
  }
  if (!tenor || isNaN(tenor) || tenor <= 0 || !Number.isInteger(tenor)) {
    return c.json({ success: false, message: 'Tenor pinjaman harus berupa angka bulan yang valid (> 0)' }, 400);
  }
  if (!purpose) {
    return c.json({ success: false, message: 'Keperluan pinjaman wajib diisi' }, 400);
  }
  if (!attachmentUrl) {
    return c.json({ success: false, message: 'Lampiran dokumen pendukung wajib diunggah' }, 400);
  }

  const result = await applyMemberLoan(db, memberId, {
      amount,
      tenor,
      purpose,
      attachmentUrl,
      attachmentName,
    });

    notifyLoanApplication({
      memberName: result.memberName,
      amount,
      tenorMonths: tenor,
      db,
    });

    return c.json({
      success: true,
      message: 'Pengajuan pinjaman berhasil dikirim dan sedang menunggu persetujuan pengurus.',
      data: {
        id: result.id,
        amount,
        tenor,
        purpose,
        status: 'Menunggu',
        createdAt: result.createdAt,
        attachmentUrl,
        attachmentName,
      },
    });
};

memberSelfService.post('/loans/apply', handleLoanApplication);
memberSelfService.post('/loans', handleLoanApplication);

// Financial Report: Income Statement for Members
memberSelfService.get('/reports/income-statement', async (c) => {
  const data = await getMemberIncomeStatement(db);
  return c.json({ success: true, data });
});

// Financial Report: Balance Sheet for Members
memberSelfService.get('/reports/balance-sheet', async (c) => {
  const data = await getMemberBalanceSheet(db);
  return c.json({ success: true, data });
});

// Financial Report: Cash Flow Statement for Members
memberSelfService.get('/reports/cashflow-statement', async (c) => {
  const data = await getMemberCashflowStatement(db);
  return c.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Member SHU & Year-End Projections Endpoint
// ---------------------------------------------------------------------------
memberSelfService.get('/shu', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const memberId = payload.sub;
  const year = c.req.query('year');

  try {
    const data = await getMemberShuPortal(db, memberId, year);
    return c.json({
      success: true,
      data,
    });
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    return c.json({ success: false, message: err.message || 'Gagal menghitung SHU' }, status);
  }
});

export default memberSelfService;
