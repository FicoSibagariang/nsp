/**
 * Pure calculation logic for Koperasi business operations.
 *
 * All functions in this module are deterministic pure functions without
 * any database dependencies or side effects. They can be executed in
 * in-memory unit tests in milliseconds without requiring an active PostgreSQL instance.
 */

// ---------------------------------------------------------------------------
// 1. Loan & Interest Calculations
// ---------------------------------------------------------------------------

export interface LoanInterestResult {
  interestAmount: number;
  totalAmount: number;
  monthlyPayment: number;
}

/**
 * Calculates loan interest using annuity / declining balance formula.
 * Tenor is in months, bungaRate is annual interest rate percentage (e.g., 18 for 18%/yr).
 */
export function calculateLoanInterest(
  amount: number,
  tenor: string | number,
  bungaRate: number
): LoanInterestResult {
  const tenorMonths = Math.max(1, parseInt(String(tenor), 10) || 1);

  if (bungaRate <= 0) {
    return {
      interestAmount: 0,
      totalAmount: amount,
      monthlyPayment: Math.ceil(amount / tenorMonths),
    };
  }

  const i = bungaRate / 1200;
  const power = Math.pow(1 + i, tenorMonths);
  const monthlyPayment = (amount * (i * power)) / (power - 1);

  const roundedMonthlyPayment = Math.ceil(monthlyPayment);
  const totalAmount = roundedMonthlyPayment * tenorMonths;
  const interestAmount = totalAmount - amount;

  return {
    interestAmount,
    totalAmount,
    monthlyPayment: roundedMonthlyPayment,
  };
}

export interface AmortizationRow {
  installmentNo: number;
  principalAmount: number;
  interestAmount: number;
}

export interface AmortizationScheduleResult {
  monthlyPayment: number;
  totalAmount: number;
  interestAmount: number;
  rows: AmortizationRow[];
}

/**
 * Classical declining-balance (annuity) schedule:
 * - fixed monthly installment (principal + interest ≈ monthlyPayment)
 * - early periods: higher interest, lower principal
 * - later periods: lower interest, higher principal
 * - sum of principalAmount === original principal
 */
export function buildAmortizationSchedule(
  principal: number,
  tenor: string | number,
  annualRatePercent: number
): AmortizationScheduleResult {
  const tenorMonths = Math.max(1, parseInt(String(tenor), 10) || 1);
  const amount = Math.max(0, Math.round(Number(principal) || 0));
  const { monthlyPayment, totalAmount, interestAmount } = calculateLoanInterest(
    amount,
    tenorMonths,
    annualRatePercent
  );

  const monthlyRate = annualRatePercent > 0 ? annualRatePercent / 1200 : 0;
  let balance = amount;
  const rows: AmortizationRow[] = [];

  for (let month = 1; month <= tenorMonths; month++) {
    const interestPart =
      monthlyRate > 0 && balance > 0 ? Math.round(balance * monthlyRate) : 0;

    let principalPart: number;
    if (month === tenorMonths) {
      // Final installment clears remaining principal (handles rounding drift)
      principalPart = balance;
    } else if (monthlyRate <= 0) {
      principalPart = Math.floor(amount / tenorMonths);
    } else {
      principalPart = monthlyPayment - interestPart;
      if (principalPart < 0) principalPart = 0;
      if (principalPart > balance) principalPart = balance;
    }

    rows.push({
      installmentNo: month,
      principalAmount: principalPart,
      interestAmount: interestPart,
    });
    balance -= principalPart;
  }

  // Safety: if rounding left a residual (should be 0), fold into last principal
  if (balance !== 0 && rows.length > 0) {
    const last = rows[rows.length - 1];
    last.principalAmount += balance;
  }

  return { monthlyPayment, totalAmount, interestAmount, rows };
}

/**
 * Resolves the loan payment rounding tolerance from environment variable LOAN_PAYMENT_TOLERANCE.
 * Defaults to 100 rupiah if not set or invalid.
 */
export function getPaymentTolerance(): number {
  const val =
    typeof process !== "undefined" && process.env?.LOAN_PAYMENT_TOLERANCE
      ? process.env.LOAN_PAYMENT_TOLERANCE
      : typeof Bun !== "undefined"
        ? Bun.env?.LOAN_PAYMENT_TOLERANCE
        : undefined;
  const parsed = parseFloat(val || "100");
  return isNaN(parsed) ? 100 : Math.max(0, parsed);
}

// ---------------------------------------------------------------------------
// 2. SHU (Sisa Hasil Usaha) Calculations
// ---------------------------------------------------------------------------

export interface ShuConfigPercentages {
  cadanganPct: number;
  anggotaPct: number;
  pengurusPct: number;
  sosialPct: number;
  pembangunanPct: number;
  jasaSimpananPct: number;
  jasaPinjamanPct: number;
}

export interface ShuDistributionPools {
  anggota: number;
  cadangan: number;
  pengurus: number;
  sosial: number;
  pembangunan: number;
  totalJasaSimpananPool: number;
  totalJasaPinjamanPool: number;
}

/**
 * Computes statutory allocation pools from net SHU (SHU Netto).
 */
export function calculateShuPools(
  shuNetto: number,
  config: ShuConfigPercentages
): ShuDistributionPools {
  const net = Math.max(0, shuNetto);

  const anggota = Math.round(net * (config.anggotaPct / 100));
  const cadangan = Math.round(net * (config.cadanganPct / 100));
  const pengurus = Math.round(net * (config.pengurusPct / 100));
  const sosial = Math.round(net * (config.sosialPct / 100));
  const pembangunan = Math.round(net * (config.pembangunanPct / 100));

  const totalJasaSimpananPool = Math.round(anggota * (config.jasaSimpananPct / 100));
  const totalJasaPinjamanPool = Math.round(anggota * (config.jasaPinjamanPct / 100));

  return {
    anggota,
    cadangan,
    pengurus,
    sosial,
    pembangunan,
    totalJasaSimpananPool,
    totalJasaPinjamanPool,
  };
}

export interface MemberShuParticipation {
  memberId: string;
  name: string;
  status?: string;
  totalSavings: number;
  averageSavings: number;
  interestPaid: number;
}

export interface ShuMemberAllocationResult {
  id: string;
  name: string;
  status: string;
  totalSavings: number;
  averageSavings: number;
  savingsShare: number;
  loansShare: number;
  shu: number;
}

export interface ShuDistributionResult {
  totalPendapatan: number;
  biayaOperasional: number;
  shuNetto: number;
  distribusi: {
    anggota: number;
    cadangan: number;
    pengurus: number;
    sosial: number;
    pembangunan: number;
  };
  totalJasaSimpananPool: number;
  totalJasaPinjamanPool: number;
  alokasiAnggota: ShuMemberAllocationResult[];
}

/**
 * Pure calculation of annual SHU distribution and individual member allocations.
 * Distributes Jasa Simpanan proportionally based on time-weighted average savings (ADB),
 * and Jasa Pinjaman proportionally based on actual interest paid.
 */
export function calculateShuDistribution(
  totalPendapatan: number,
  biayaOperasional: number,
  config: ShuConfigPercentages,
  members: MemberShuParticipation[]
): ShuDistributionResult {
  const shuNetto = Math.max(0, totalPendapatan - biayaOperasional);
  const pools = calculateShuPools(shuNetto, config);

  const totalSimpananSeluruhAnggota = members.reduce(
    (sum, m) => sum + (m.averageSavings || 0),
    0
  );
  const totalBungaDibayarSeluruhAnggota = members.reduce(
    (sum, m) => sum + (m.interestPaid || 0),
    0
  );

  const alokasiAnggota: ShuMemberAllocationResult[] = members
    .map((m) => {
      const savings = m.totalSavings || 0;
      const avgSavings = m.averageSavings || 0;
      const interestPaid = m.interestPaid || 0;

      const porsiSimpanan =
        totalSimpananSeluruhAnggota > 0 ? avgSavings / totalSimpananSeluruhAnggota : 0;
      const porsiPinjaman =
        totalBungaDibayarSeluruhAnggota > 0
          ? interestPaid / totalBungaDibayarSeluruhAnggota
          : 0;

      const savingsShare = Math.round(pools.totalJasaSimpananPool * porsiSimpanan);
      const loansShare = Math.round(pools.totalJasaPinjamanPool * porsiPinjaman);

      return {
        id: m.memberId,
        name: m.name,
        status: m.status || "Aktif",
        totalSavings: savings,
        averageSavings: avgSavings,
        savingsShare,
        loansShare,
        shu: savingsShare + loansShare,
      };
    })
    .sort((a, b) => b.shu - a.shu);

  return {
    totalPendapatan,
    biayaOperasional,
    shuNetto,
    distribusi: {
      anggota: pools.anggota,
      cadangan: pools.cadangan,
      pengurus: pools.pengurus,
      sosial: pools.sosial,
      pembangunan: pools.pembangunan,
    },
    totalJasaSimpananPool: pools.totalJasaSimpananPool,
    totalJasaPinjamanPool: pools.totalJasaPinjamanPool,
    alokasiAnggota,
  };
}

// ---------------------------------------------------------------------------
// 3. EWA (Earned Wage Access) Pure Calculations
// ---------------------------------------------------------------------------

export interface EwaFeeTierItem {
  id?: string;
  minAmount: number;
  maxAmount: number | null;
  memberFee: number;
  nonMemberFee: number;
  [key: string]: any;
}

export interface EwaFeeResult<T = EwaFeeTierItem> {
  feeAmount: number;
  feePercentage: number;
  tier: T | null;
}

/**
 * Calculates EWA fee and percentage based on fee tiers without database calls.
 */
export function calculateEwaFeeFromTiers<T extends EwaFeeTierItem = EwaFeeTierItem>(
  tiers: T[],
  requestedAmount: number,
  isMember: boolean,
  fallbackMemberPct = 2.5,
  fallbackNonMemberPct = 5.0
): EwaFeeResult<T> {
  const matched = tiers.find((t) => {
    if (requestedAmount < t.minAmount) return false;
    if (t.maxAmount != null && requestedAmount > t.maxAmount) return false;
    return true;
  });

  if (matched) {
    const feeAmount = isMember ? matched.memberFee : matched.nonMemberFee;
    const feePercentage =
      requestedAmount > 0
        ? Math.round((feeAmount / requestedAmount) * 10000) / 100
        : 0;
    return { feeAmount, feePercentage, tier: matched };
  }

  const feePercentage = isMember ? fallbackMemberPct : fallbackNonMemberPct;
  const feeAmount = Math.round((requestedAmount * feePercentage) / 100);
  return { feeAmount, feePercentage, tier: null };
}

export interface EwaWithdrawalLimitResult {
  earnedAmount: number;
  maxAllowedFromSalary: number;
  effectiveLimit: number;
  availableLimit: number;
}

/**
 * Calculates prorated earned wages and remaining withdrawable limit for an EWA cycle.
 */
export function calculateEwaWithdrawalLimit(
  salary: number,
  daysElapsedInCycle: number,
  totalDaysInCycle: number,
  maxPercentSalary = 50,
  priorWithdrawals = 0,
  monthlyLoanObligation = 0
): EwaWithdrawalLimitResult {
  const safeTotalDays = Math.max(1, totalDaysInCycle);
  const safeElapsed = Math.min(safeTotalDays, Math.max(0, daysElapsedInCycle));
  const earnedAmount = Math.floor((salary * safeElapsed) / safeTotalDays);

  const maxAllowedFromSalary = Math.floor(salary * (maxPercentSalary / 100));
  const effectiveLimit = Math.min(earnedAmount, maxAllowedFromSalary);
  const availableLimit = Math.max(
    0,
    effectiveLimit - priorWithdrawals - monthlyLoanObligation
  );

  return {
    earnedAmount,
    maxAllowedFromSalary,
    effectiveLimit,
    availableLimit,
  };
}
