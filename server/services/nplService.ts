import type { Db } from '../db';
import type { LoanRow, GroupCount } from '../db/entities';
import { calculateLoanInterest, getPaymentTolerance } from './loanService';

export async function getNplReport(
  database: Db,
  page: number,
  limit: number
): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
  summary: any;
}> {
  const offset = (page - 1) * limit;

  const bungaSetting = await database
    .query("SELECT value FROM settings WHERE key = 'bungaPinjaman'")
    .get<{ value: string }>();
  const bungaRate = parseFloat(bungaSetting?.value || '0');
  const tolerance = getPaymentTolerance();

  const rows = await database
    .query(`
      SELECT l.*,
             COALESCE(SUM(p.amount), 0) as "paidAmount",
             (SELECT MIN(ls.dueDate) 
              FROM loan_schedules ls 
              WHERE ls.loanId = l.id 
                AND ls.status != 'Paid' 
                AND (COALESCE(ls.principalAmount, 0) + COALESCE(ls.interestAmount, 0) + COALESCE(ls.lateFee, 0) - COALESCE(ls.paidAmount, 0)) > ?
                AND ls.dueDate < CURRENT_DATE
             ) as oldestOverdueDate
      FROM loans l
      LEFT JOIN loan_payments p ON l.id = p.loanId
      WHERE l.status IN ('Disetujui', 'Macet')
      GROUP BY l.id
      ORDER BY COALESCE((
        SELECT MIN(ls.dueDate) 
        FROM loan_schedules ls 
        WHERE ls.loanId = l.id 
          AND ls.status != 'Paid' 
          AND (COALESCE(ls.principalAmount, 0) + COALESCE(ls.interestAmount, 0) + COALESCE(ls.lateFee, 0) - COALESCE(ls.paidAmount, 0)) > ?
          AND ls.dueDate < CURRENT_DATE
      )::text, l.createdAt) DESC NULLS LAST
      LIMIT ? OFFSET ?
    `)
    .all<LoanRow & { oldestOverdueDate: string | null }>(tolerance, tolerance, limit, offset);

  const mappedLoans = rows.map((loan) => {
    let dpd = 0;
    if (loan.oldestOverdueDate) {
      const oldestDueDate = new Date(loan.oldestOverdueDate);
      const today = new Date();
      dpd = Math.max(0, Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    let collectibility = 'Lancar';
    let agingBucket = 'Current';

    if (loan.status === 'Macet' || dpd > 90) {
      collectibility = 'Macet';
      agingBucket = '90+';
    } else if (dpd >= 61) {
      collectibility = 'Diragukan';
      agingBucket = '60-90';
    } else if (dpd >= 31) {
      collectibility = 'Kurang Lancar';
      agingBucket = '30-60';
    } else if (dpd >= 1) {
      collectibility = 'Dalam Perhatian Khusus';
      agingBucket = '1-30';
    }

    let totalAmount: number;
    if (loan.approvedAt && loan.totalAmount !== null) {
      totalAmount = Number(loan.totalAmount);
    } else {
      ({ totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate));
    }

    const remainingAmount = Math.max(0, Number(totalAmount) - Number(loan.paidAmount || 0));

    return {
      ...loan,
      interestAmount: Number(loan.interestAmount || 0),
      totalAmount: Number(totalAmount),
      remainingAmount,
      dpd,
      agingBucket,
      collectibility,
    };
  });

  const totalRes = (await database
    .query("SELECT COUNT(*) as count FROM loans WHERE status IN ('Disetujui', 'Macet')")
    .get()) as { count: number } | null;

  const [activeLoansRes, badLoansByStatusRes] = await Promise.all([
    database.query("SELECT SUM(amount) as s FROM loans WHERE status IN ('Disetujui', 'Macet')").get<{ s: number | null }>(),
    database.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet'").get<{ s: number | null }>(),
  ]);

  const nplLoansByDPD = await database.query(`
    SELECT l.id, l.amount
    FROM loans l
    WHERE l.status IN ('Disetujui', 'Macet')
    AND EXISTS (
      SELECT 1 FROM loan_schedules ls
      WHERE ls.loanId = l.id
      AND ls.status != 'Paid'
      AND (COALESCE(ls.principalAmount, 0) + COALESCE(ls.interestAmount, 0) + COALESCE(ls.lateFee, 0) - COALESCE(ls.paidAmount, 0)) > ?
      AND ls.dueDate < CURRENT_DATE - INTERVAL '90 days'
    )
  `).all<Pick<LoanRow, 'id' | 'amount'>>(tolerance);

  const totalNPLByDPD = nplLoansByDPD.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

  const totalActivePrincipal = activeLoansRes?.s || 0;
  const totalBadPrincipalByStatus = badLoansByStatusRes?.s || 0;
  const totalNPLByDPDNum = totalNPLByDPD;

  const nplRatioByStatus = totalActivePrincipal > 0 ? (totalBadPrincipalByStatus / totalActivePrincipal) * 100 : 0;
  const nplRatioByDPD = totalActivePrincipal > 0 ? (totalNPLByDPDNum / totalActivePrincipal) * 100 : 0;

  const agingBuckets = await database.query(`
    SELECT
      CASE
        WHEN oldestDueDate IS NULL OR oldestDueDate >= CURRENT_DATE THEN 'Current'
        WHEN oldestDueDate >= CURRENT_DATE - INTERVAL '30 days' THEN '30-60'
        WHEN oldestDueDate >= CURRENT_DATE - INTERVAL '60 days' THEN '60-90'
        ELSE '90+'
      END as bucket,
      COUNT(*) as count
    FROM (
      SELECT l.id,
             (SELECT MIN(ls.dueDate) 
              FROM loan_schedules ls 
              WHERE ls.loanId = l.id 
                AND ls.status != 'Paid'
                AND (COALESCE(ls.principalAmount, 0) + COALESCE(ls.interestAmount, 0) + COALESCE(ls.lateFee, 0) - COALESCE(ls.paidAmount, 0)) > ?
             ) as oldestDueDate
      FROM loans l
      WHERE l.status IN ('Disetujui', 'Macet')
    ) sub
    GROUP BY 1
  `).all<GroupCount>(tolerance);

  return {
    data: mappedLoans,
    total: totalRes?.count ?? 0,
    page,
    limit,
    summary: {
      totalActivePrincipal,
      totalBadPrincipal: totalBadPrincipalByStatus,
      totalBadPrincipalByStatus,
      totalNPLByDPD: totalNPLByDPDNum,
      nplRatio: nplRatioByStatus,
      nplRatioByStatus,
      nplRatioByDPD,
      agingBuckets: Object.fromEntries(agingBuckets.map((b) => [b.bucket, Number(b.count || 0)])),
      badAccountsCount: nplLoansByDPD.length,
    },
  };
}
