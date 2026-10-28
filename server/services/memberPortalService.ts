import type { Db } from '../db';
import { getEmployeeById, getEmployeeByEmail } from './ewaService';
import { calculateSHU } from './shuService';
import { ServiceError } from './errors';

export async function findEmployeeIdByMemberId(
  database: Db,
  memberId: string
): Promise<string | null> {
  const emp = await database
    .query("SELECT id FROM employees WHERE member_id = ? LIMIT 1")
    .get<{ id: string }>(memberId);
  return emp?.id || null;
}

export async function getMemberPortalProfile(
  database: Db,
  memberId: string,
  email?: string
): Promise<any> {
  const member = await database
    .query(
      "SELECT id, name, role, status, joinDate, nik, phone, simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?"
    )
    .get<any>(memberId);

  let employee = null;
  if (email) {
    employee = await getEmployeeByEmail(database, email);
  }
  if (!employee && memberId) {
    const empId = await findEmployeeIdByMemberId(database, memberId);
    if (empId) {
      employee = await getEmployeeById(database, empId);
    }
  }

  if (!member && !employee) return null;

  const isCoopMember = !!member;
  const settingsRows = await database
    .query(
      "SELECT key, value FROM settings WHERE key IN ('bungaPinjaman', 'coopBankName', 'coopBankAccountNumber', 'coopBankAccountName', 'koperasiName', 'viewReports', 'viewMemberShu')"
    )
    .all<{ key: string; value: string }>();

  const settingsMap: Record<string, string> = {};
  for (const s of settingsRows) {
    settingsMap[s.key] = s.value;
  }
  const loanInterestRate = parseFloat(settingsMap['bungaPinjaman'] || "0");
  const canViewReports = settingsMap['viewReports'] === 'true';
  const canViewShu = settingsMap['viewMemberShu'] !== 'false';

  return {
    id: member?.id || employee?.id,
    name: member?.name || employee?.name,
    email: member?.email || employee?.email,
    phone: member?.phone || employee?.phone,
    role: member?.role || 'Karyawan',
    status: member?.status || employee?.status || 'Aktif',
    joinDate: member?.joinDate
      ? String(member.joinDate).slice(0, 10)
      : employee?.createdAt
      ? new Date(employee.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    nik: member?.nik || employee?.nik,
    simpananPokok: Number(member?.simpananPokok || 0),
    simpananWajib: Number(member?.simpananWajib || 0),
    simpananSukarela: Number(member?.simpananSukarela || 0),
    totalSavings: Number(member?.totalSavings || 0),
    isCoopMember,
    canViewReports,
    canViewShu,
    loanInterestRate,
    coopBank: {
      bankName: settingsMap['coopBankName'] || 'Bank Mandiri',
      accountNumber: settingsMap['coopBankAccountNumber'] || '1060022716008',
      accountName: settingsMap['coopBankAccountName'] || settingsMap['koperasiName'] || 'Koperasi Jasa Nusa Sejahtera Prima',
    },
    employee: employee ? {
      id: employee.id,
      nip: employee.nip,
      salary: employee.salary,
      jobTitle: employee.jobTitle,
      department: employee.department,
    } : null,
  };
}

export async function getMemberSavingsTransactions(
  database: Db,
  memberId: string
): Promise<any[]> {
  return database
    .query(
      "SELECT id, type, amount, balanceBefore, balanceAfter, createdAt, createdBy FROM transactions WHERE memberId = ? ORDER BY seq DESC"
    )
    .all(memberId);
}

export async function getMemberNameAndNik(
  database: Db,
  memberId: string
): Promise<{ name: string; nik?: string } | null> {
  return database
    .query("SELECT name, nik FROM members WHERE id = ?")
    .get<{ name: string; nik?: string }>(memberId);
}

export async function getMemberLoans(
  database: Db,
  memberId: string
): Promise<any[]> {
  return database
    .query(
      `SELECT l.id, COALESCE(m.name, l.name) AS name, l.amount, l.tenor, l.purpose, l.status, l.createdAt,
              l.interestRate, l.monthlyPayment, l.interestAmount, l.totalAmount,
              l.approvedAt, l.totalInstallments, l.paidInstallments,
              l."attachmentUrl", l."attachmentName",
              l.rejection_reason AS "rejectionReason",
              COALESCE(SUM(p.amount), 0) AS paidAmount
       FROM loans l
       LEFT JOIN members m ON m.id = l.memberId
       LEFT JOIN loan_payments p ON l.id = p.loanId
       WHERE l.memberId = ? AND l.deletedAt IS NULL
       GROUP BY l.id, m.name
       ORDER BY l.createdAt DESC`
    )
    .all(memberId);
}

export async function getMemberLoanSchedule(
  database: Db,
  loanId: string,
  memberId: string
): Promise<any[] | null> {
  const loan = await database
    .query("SELECT id FROM loans WHERE id = ? AND memberId = ?")
    .get(loanId, memberId);

  if (!loan) return null;

  return database
    .query(
      "SELECT id, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status, lateFee, paidAt FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC"
    )
    .all(loanId);
}

export async function getMemberLoanPayments(
  database: Db,
  loanId: string,
  memberId: string
): Promise<any[] | null> {
  const loan = await database
    .query("SELECT id FROM loans WHERE id = ? AND memberId = ?")
    .get(loanId, memberId);

  if (!loan) return null;

  return database
    .query(
      'SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE loanId = ? ORDER BY paymentDate ASC, id ASC'
    )
    .all(loanId);
}

export async function applyMemberLoan(
  database: Db,
  memberId: string,
  data: {
    amount: number;
    tenor: number;
    purpose: string;
    attachmentUrl: string;
    attachmentName?: string | null;
  }
): Promise<{ id: string; amount: number; tenor: number; purpose: string; status: string; createdAt: string; attachmentUrl: string; attachmentName?: string | null; memberName: string }> {
  const member = await database
    .query("SELECT id, name, status FROM members WHERE id = ? AND deletedAt IS NULL")
    .get<{ id: string; name: string; status: string }>(memberId);

  if (!member) {
    throw new ServiceError('Data anggota tidak ditemukan', 404);
  }

  const existingPending = await database
    .query("SELECT id FROM loans WHERE memberId = ? AND status = 'Menunggu' AND deletedAt IS NULL")
    .get(memberId);

  if (existingPending) {
    throw new ServiceError('Anda masih memiliki pengajuan pinjaman yang sedang menunggu persetujuan pengurus.', 400);
  }

  const loanId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await database.run(
    `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, "attachmentUrl", "attachmentName")
     VALUES (?, ?, ?, ?, ?, ?, 'Menunggu', ?, ?, ?)`,
    [loanId, memberId, member.name, data.amount, data.tenor, data.purpose, createdAt, data.attachmentUrl, data.attachmentName || null]
  );

  return {
    id: loanId,
    amount: data.amount,
    tenor: data.tenor,
    purpose: data.purpose,
    status: 'Menunggu',
    createdAt,
    attachmentUrl: data.attachmentUrl,
    attachmentName: data.attachmentName || null,
    memberName: member.name,
  };
}

export async function getMemberIncomeStatement(database: Db): Promise<any> {
  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.type IN ('REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await database.query(query).all();

  const revenues = rows
    .filter((r: any) => r.type === 'REVENUE')
    .map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  const expenses = rows
    .filter((r: any) => r.type === 'EXPENSE')
    .map((r: any) => ({ ...r, balance: Number(r.total_debit) - Number(r.total_credit) }));

  const totalRevenue = revenues.reduce((sum, r) => sum + r.balance, 0);
  const totalExpense = expenses.reduce((sum, r) => sum + r.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  return { revenues, expenses, totalRevenue, totalExpense, netIncome };
}

export async function getMemberBalanceSheet(database: Db): Promise<any> {
  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await database.query(query).all();

  const revenues = rows
    .filter((r: any) => r.type === 'REVENUE')
    .map((r: any) => Number(r.total_credit) - Number(r.total_debit));
  const expenses = rows
    .filter((r: any) => r.type === 'EXPENSE')
    .map((r: any) => Number(r.total_debit) - Number(r.total_credit));
  const netIncome = revenues.reduce((a, b) => a + b, 0) - expenses.reduce((a, b) => a + b, 0);

  const assets = rows
    .filter((r: any) => r.type === 'ASSET')
    .map((r: any) => ({ ...r, balance: Number(r.total_debit) - Number(r.total_credit) }));
  const liabilities = rows
    .filter((r: any) => r.type === 'LIABILITY')
    .map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  const equity = rows
    .filter((r: any) => r.type === 'EQUITY')
    .map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));

  const shuTahunBerjalan = equity.find((e) => e.code === '33102');
  if (shuTahunBerjalan) {
    shuTahunBerjalan.balance += netIncome;
  } else {
    equity.push({
      code: '33102',
      name: 'SHU Tahun Berjalan',
      type: 'EQUITY',
      normal_balance: 'CREDIT',
      total_debit: 0,
      total_credit: netIncome,
      balance: netIncome,
    });
  }

  const totalAssets = assets.reduce((sum, r) => sum + r.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + r.balance, 0);
  const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

export async function getMemberCashflowStatement(database: Db): Promise<any> {
  const query = `
    SELECT 
      CASE WHEN jl.debit > 0 THEN 'inflow' ELSE 'outflow' END as category, 
      COALESCE(a_counter.code, 'other') as counter_code,
      COALESCE(a_counter.name, 'Lain-lain') as counter_name,
      COALESCE(a_counter.type, 'OTHER') as counter_type,
      COALESCE(je.reference_type, 'jurnal_umum') as reference_type,
      SUM(CASE WHEN jl.debit > 0 THEN jl_counter.credit ELSE jl_counter.debit END) as total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN journal_lines jl_counter ON jl.journal_entry_id = jl_counter.journal_entry_id AND jl.id != jl_counter.id
    LEFT JOIN accounts a_counter ON jl_counter.account_id = a_counter.id
    WHERE a.code IN ('11101', '11102') AND (a_counter.code NOT IN ('11101', '11102') OR a_counter.code IS NULL)
    GROUP BY category, counter_code, counter_name, counter_type, reference_type
    ORDER BY category, total DESC
  `;
  const rows = await database.query(query).all();

  const getDetailLabel = (category: string, counterCode: string, counterName: string) => {
    if (category === 'inflow') {
      switch (counterCode) {
        case '31101': return 'Setoran Simpanan Pokok Anggota';
        case '31102': return 'Setoran Simpanan Wajib Anggota';
        case '21101': return 'Setoran Simpanan Sukarela Anggota';
        case '11201': return 'Penerimaan Angsuran Pokok Pinjaman';
        case '41101': return 'Penerimaan Jasa / Bunga Pinjaman';
        case '41102': return 'Penerimaan Provisi & Administrasi';
        case '41103': return 'Penerimaan Biaya Layanan Gaji Awal (EWA)';
        case '11301': return 'Pelunasan Payroll Kasbon Gaji (EWA)';
        case '42101': return 'Penerimaan Bunga Bank / Jasa Giro';
        case '42102': return 'Penerimaan Pendapatan Denda';
        case '21201': return 'Penerimaan Kas Awal Koperasi';
        default: return `Penerimaan: ${counterName}`;
      }
    } else {
      switch (counterCode) {
        case '11201': return 'Pencairan Penyaluran Pinjaman';
        case '21101': return 'Penarikan Simpanan Sukarela';
        case '11301': return 'Pencairan Kasbon Gaji Awal (EWA)';
        case '61101': return 'Pembayaran Beban Gaji & Tunjangan';
        case '61201': return 'Pembayaran Beban Operasional Kantor';
        case '61301': return 'Pembayaran Beban Pelaksanaan RAT';
        case '12101': return 'Pengeluaran Pembelian Peralatan';
        case '11401': return 'Pengeluaran Pembelian Perlengkapan';
        default: return `Pengeluaran: ${counterName}`;
      }
    }
  };

  const inflows = rows
    .filter((r: any) => r.category === 'inflow')
    .map((r: any) => ({
      subcategory: r.counter_name || r.reference_type,
      accountCode: r.counter_code,
      accountName: r.counter_name,
      label: getDetailLabel('inflow', r.counter_code, r.counter_name),
      total: Number(r.total || 0),
    }));

  const outflows = rows
    .filter((r: any) => r.category === 'outflow')
    .map((r: any) => ({
      subcategory: r.counter_name || r.reference_type,
      accountCode: r.counter_code,
      accountName: r.counter_name,
      label: getDetailLabel('outflow', r.counter_code, r.counter_name),
      total: Number(r.total || 0),
    }));

  const totalInflow = inflows.reduce((sum, r) => sum + r.total, 0);
  const totalOutflow = outflows.reduce((sum, r) => sum + r.total, 0);
  const netCashFlow = totalInflow - totalOutflow;

  const cashBalanceQuery = `
    SELECT 
      a.code, a.name,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.code IN ('11101', '11102')
    GROUP BY a.code, a.name
  `;
  const cashAccounts = await database.query(cashBalanceQuery).all();
  const totalCashBalance = cashAccounts.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

  return {
    inflows,
    outflows,
    totalInflow,
    totalOutflow,
    netCashFlow,
    totalCashBalance,
    cashAccounts: cashAccounts.map((a: any) => ({ ...a, balance: Number(a.balance || 0) })),
  };
}

export async function getMemberShuPortal(
  database: Db,
  memberId: string,
  yearQuery?: string
): Promise<any> {
  const member = await database
    .query("SELECT id, name, role, status, totalSavings, joinDate FROM members WHERE id = ? AND deletedAt IS NULL")
    .get<any>(memberId);

  if (!member) {
    throw new ServiceError('Layanan informasi SHU hanya tersedia bagi anggota koperasi terdaftar.', 404);
  }

  const settingRow = await database
    .query("SELECT value FROM settings WHERE key = 'viewMemberShu'")
    .get<{ value: string }>();

  const isEnabled = settingRow ? settingRow.value !== 'false' : true;
  if (!isEnabled) {
    throw new ServiceError('Fitur informasi dan proyeksi SHU saat ini dinonaktifkan oleh pengurus koperasi.', 403);
  }

  const currentCalendarYear = new Date().getFullYear().toString();
  const year = yearQuery || currentCalendarYear;

  const projectionData = await calculateSHU(year, { mode: 'projection' });
  const myProjection = projectionData.alokasiAnggota.find((a: any) => a.id === memberId) || {
    id: memberId,
    name: member.name,
    status: member.status || 'Aktif',
    totalSavings: Number(member.totalSavings || 0),
    averageSavings: 0,
    savingsShare: 0,
    loansShare: 0,
    shu: 0,
  };

  const totalCoopSavings = projectionData.alokasiAnggota.reduce(
    (sum: number, a: any) => sum + (Number(a.averageSavings ?? a.totalSavings) || 0),
    0
  );
  const jasaSimpananPoolProj = Math.round(
    (projectionData.distribusi?.anggota || 0) * ((projectionData.config?.jasaSimpananPct ?? 50) / 100)
  );
  const jasaPinjamanPoolProj = Math.round(
    (projectionData.distribusi?.anggota || 0) * ((projectionData.config?.jasaPinjamanPct ?? 50) / 100)
  );

  let myRealization = null;
  let realizationSummary = null;

  if (!projectionData.isClosed) {
    const realizationData = await calculateSHU(year, { mode: 'realization' });
    const myReal = realizationData.alokasiAnggota.find((a: any) => a.id === memberId) || {
      id: memberId,
      name: member.name,
      status: member.status || 'Aktif',
      totalSavings: Number(member.totalSavings || 0),
      averageSavings: 0,
      savingsShare: 0,
      loansShare: 0,
      shu: 0,
    };
    myRealization = myReal;

    const jasaSimpananPoolReal = Math.round(
      (realizationData.distribusi?.anggota || 0) * ((realizationData.config?.jasaSimpananPct ?? 50) / 100)
    );
    const jasaPinjamanPoolReal = Math.round(
      (realizationData.distribusi?.anggota || 0) * ((realizationData.config?.jasaPinjamanPct ?? 50) / 100)
    );

    realizationSummary = {
      pendapatan: realizationData.pendapatan,
      biayaOperasional: realizationData.biayaOperasional,
      shuNetto: realizationData.shuNetto,
      distribusiAnggota: realizationData.distribusi.anggota,
      jasaSimpananPool: jasaSimpananPoolReal,
      jasaPinjamanPool: jasaPinjamanPoolReal,
    };
  }

  const historical = await database
    .query(
      `SELECT 
        sma.year,
        sma.savingsShare,
        sma.loansShare,
        sma.totalSHU,
        sma.averageSavings,
        sc.closedAt,
        sc.closedBy,
        sc.shuNetto as "coopShuNetto"
      FROM shu_member_allocations sma
      JOIN shu_closes sc ON sma.year = sc.year
      WHERE sma.memberId = ?
      ORDER BY sma.year DESC`
    )
    .all<any>(memberId);

  const closedYears = await database
    .query("SELECT year FROM shu_closes ORDER BY year DESC")
    .all<{ year: string }>();

  const yearSet = new Set<string>([currentCalendarYear, ...closedYears.map((cy) => cy.year)]);
  const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

  return {
    year,
    isCurrentYear: year === currentCalendarYear,
    isClosed: projectionData.isClosed,
    closedAt: (projectionData as any).closedAt || null,
    projection: {
      totalRevenue: projectionData.pendapatan,
      realizedRevenue: projectionData.realizedPendapatan,
      projectedRevenue: projectionData.projectedPendapatan,
      biayaOperasional: projectionData.biayaOperasional,
      shuNetto: projectionData.shuNetto,
      distribusiAnggota: projectionData.distribusi?.anggota || 0,
      jasaSimpananPool: jasaSimpananPoolProj,
      jasaPinjamanPool: jasaPinjamanPoolProj,
      totalCoopSavings,
      member: myProjection,
    },
    realization: myRealization
      ? {
          summary: realizationSummary,
          member: myRealization,
        }
      : null,
    config: projectionData.config,
    historical: historical.map((h: any) => ({
      year: h.year,
      savingsShare: Number(h.savingsShare || 0),
      loansShare: Number(h.loansShare || 0),
      totalSHU: Number(h.totalSHU || 0),
      averageSavings: Number(h.averageSavings || 0),
      closedAt: h.closedAt,
      coopShuNetto: Number(h.coopShuNetto || 0),
    })),
    availableYears,
  };
}
