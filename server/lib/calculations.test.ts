import { describe, expect, test } from "bun:test";
import {
  calculateLoanInterest,
  buildAmortizationSchedule,
  getPaymentTolerance,
  calculateShuPools,
  calculateShuDistribution,
  calculateEwaFeeFromTiers,
  calculateEwaWithdrawalLimit,
  type ShuConfigPercentages,
  type MemberShuParticipation,
  type EwaFeeTierItem,
} from "./calculations";

describe("Pure Calculation Logic (Database-Independent)", () => {
  describe("Loan Interest Calculation", () => {
    test("calculates annuity interest for standard 12-month loan at 18%", () => {
      const res = calculateLoanInterest(10_000_000, 12, 18);
      expect(res.monthlyPayment).toBe(916_800);
      expect(res.totalAmount).toBe(11_001_600);
      expect(res.interestAmount).toBe(1_001_600);
    });

    test("handles zero interest rate correctly", () => {
      const res = calculateLoanInterest(6_000_000, 6, 0);
      expect(res.interestAmount).toBe(0);
      expect(res.totalAmount).toBe(6_000_000);
      expect(res.monthlyPayment).toBe(1_000_000);
    });

    test("handles single-period loan", () => {
      const res = calculateLoanInterest(2_000_000, 1, 24);
      expect(res.interestAmount).toBe(40_000);
      expect(res.totalAmount).toBe(2_040_000);
      expect(res.monthlyPayment).toBe(2_040_000);
    });

    test("handles string tenor and invalid tenor safely", () => {
      const res = calculateLoanInterest(2_000_000, "invalid" as any, 24);
      expect(res.totalAmount).toBe(2_040_000);
    });
  });

  describe("Amortization Schedule Generation", () => {
    test("declining balance schedule sums exactly to principal with declining interest", () => {
      const schedule = buildAmortizationSchedule(10_000_000, 12, 18);
      expect(schedule.rows.length).toBe(12);

      const sumPrincipal = schedule.rows.reduce(
        (sum, row) => sum + row.principalAmount,
        0
      );
      expect(sumPrincipal).toBe(10_000_000);

      // Early installment interest is higher than later installment interest
      expect(schedule.rows[0].interestAmount).toBeGreaterThan(
        schedule.rows[11].interestAmount
      );
      // Early installment principal is lower than later installment principal
      expect(schedule.rows[0].principalAmount).toBeLessThan(
        schedule.rows[11].principalAmount
      );
    });

    test("zero interest splits principal evenly and absorbs remainder in last row", () => {
      const schedule = buildAmortizationSchedule(1_000_000, 3, 0);
      expect(schedule.rows.length).toBe(3);
      expect(schedule.rows[0].principalAmount).toBe(333_333);
      expect(schedule.rows[1].principalAmount).toBe(333_333);
      expect(schedule.rows[2].principalAmount).toBe(333_334);

      const sumPrincipal = schedule.rows.reduce(
        (sum, row) => sum + row.principalAmount,
        0
      );
      expect(sumPrincipal).toBe(1_000_000);
    });

    test("single period loan clears principal in one row", () => {
      const schedule = buildAmortizationSchedule(5_000_000, 1, 12);
      expect(schedule.rows.length).toBe(1);
      expect(schedule.rows[0].principalAmount).toBe(5_000_000);
      expect(schedule.rows[0].interestAmount).toBe(50_000);
    });
  });

  describe("Payment Tolerance", () => {
    test("returns default 100 rupiah when env is not set", () => {
      expect(getPaymentTolerance()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SHU Allocation & Distribution", () => {
    const defaultConfig: ShuConfigPercentages = {
      cadanganPct: 25,
      anggotaPct: 40,
      pengurusPct: 20,
      sosialPct: 10,
      pembangunanPct: 5,
      jasaSimpananPct: 50,
      jasaPinjamanPct: 50,
    };

    test("calculateShuPools computes statutory pools accurately", () => {
      const pools = calculateShuPools(100_000_000, defaultConfig);
      expect(pools.cadangan).toBe(25_000_000);
      expect(pools.anggota).toBe(40_000_000);
      expect(pools.pengurus).toBe(20_000_000);
      expect(pools.sosial).toBe(10_000_000);
      expect(pools.pembangunan).toBe(5_000_000);
      expect(pools.totalJasaSimpananPool).toBe(20_000_000);
      expect(pools.totalJasaPinjamanPool).toBe(20_000_000);
    });

    test("clamps negative net SHU to 0", () => {
      const pools = calculateShuPools(-50_000_000, defaultConfig);
      expect(pools.anggota).toBe(0);
      expect(pools.cadangan).toBe(0);
    });

    test("calculateShuDistribution allocates Jasa Simpanan and Pinjaman proportionally", () => {
      const members: MemberShuParticipation[] = [
        {
          memberId: "m1",
          name: "Budi",
          status: "Aktif",
          totalSavings: 10_000_000,
          averageSavings: 10_000_000, // 50% of savings pool
          interestPaid: 2_000_000, // 20% of loan pool
        },
        {
          memberId: "m2",
          name: "Siti",
          status: "Aktif",
          totalSavings: 10_000_000,
          averageSavings: 10_000_000, // 50% of savings pool
          interestPaid: 8_000_000, // 80% of loan pool
        },
      ];

      const res = calculateShuDistribution(
        150_000_000,
        50_000_000, // SHU Netto = 100_000_000
        defaultConfig,
        members
      );

      expect(res.shuNetto).toBe(100_000_000);
      expect(res.totalJasaSimpananPool).toBe(20_000_000);
      expect(res.totalJasaPinjamanPool).toBe(20_000_000);

      // Members sorted by total SHU descending
      expect(res.alokasiAnggota.length).toBe(2);
      const siti = res.alokasiAnggota.find((m) => m.name === "Siti")!;
      const budi = res.alokasiAnggota.find((m) => m.name === "Budi")!;

      // Siti: 50% of 20M = 10M (savings), 80% of 20M = 16M (loans) => total 26M
      expect(siti.savingsShare).toBe(10_000_000);
      expect(siti.loansShare).toBe(16_000_000);
      expect(siti.shu).toBe(26_000_000);

      // Budi: 50% of 20M = 10M (savings), 20% of 20M = 4M (loans) => total 14M
      expect(budi.savingsShare).toBe(10_000_000);
      expect(budi.loansShare).toBe(4_000_000);
      expect(budi.shu).toBe(14_000_000);

      // Check ranking order
      expect(res.alokasiAnggota[0].id).toBe("m2");
    });

    test("handles edge case of members with 0 savings and 0 interest without NaN", () => {
      const members: MemberShuParticipation[] = [
        {
          memberId: "m1",
          name: "Zero Member",
          totalSavings: 0,
          averageSavings: 0,
          interestPaid: 0,
        },
      ];

      const res = calculateShuDistribution(10_000_000, 2_000_000, defaultConfig, members);
      expect(res.alokasiAnggota[0].shu).toBe(0);
      expect(Number.isNaN(res.alokasiAnggota[0].shu)).toBe(false);
    });
  });

  describe("EWA Calculations", () => {
    const feeTiers: EwaFeeTierItem[] = [
      { minAmount: 100_000, maxAmount: 500_000, memberFee: 15_000, nonMemberFee: 25_000 },
      { minAmount: 500_001, maxAmount: 1_000_000, memberFee: 25_000, nonMemberFee: 45_000 },
      { minAmount: 1_000_001, maxAmount: null, memberFee: 40_000, nonMemberFee: 75_000 },
    ];

    test("calculateEwaFeeFromTiers matches correct tier for member and non-member", () => {
      const memberFee = calculateEwaFeeFromTiers(feeTiers, 300_000, true);
      expect(memberFee.feeAmount).toBe(15_000);
      expect(memberFee.feePercentage).toBe(5);

      const nonMemberFee = calculateEwaFeeFromTiers(feeTiers, 300_000, false);
      expect(nonMemberFee.feeAmount).toBe(25_000);

      const largeMemberFee = calculateEwaFeeFromTiers(feeTiers, 2_000_000, true);
      expect(largeMemberFee.feeAmount).toBe(40_000);
    });

    test("calculateEwaFeeFromTiers falls back to percentage when under minimum tier", () => {
      const fee = calculateEwaFeeFromTiers(feeTiers, 50_000, true, 2.5, 5.0);
      expect(fee.feeAmount).toBe(1_250);
      expect(fee.tier).toBeNull();
    });

    test("calculateEwaWithdrawalLimit prorates accrued wages and deducts obligations", () => {
      // 10,000,000 salary, day 15 out of 30 => earned 5,000,000
      // Max 50% salary = 5,000,000 limit
      // Prior withdrawals: 1,000,000, loan obligation: 500,000
      // Available limit = 3,500,000
      const limit = calculateEwaWithdrawalLimit(
        10_000_000,
        15,
        30,
        50,
        1_000_000,
        500_000
      );

      expect(limit.earnedAmount).toBe(5_000_000);
      expect(limit.maxAllowedFromSalary).toBe(5_000_000);
      expect(limit.effectiveLimit).toBe(5_000_000);
      expect(limit.availableLimit).toBe(3_500_000);
    });

    test("calculateEwaWithdrawalLimit clamps available limit to zero if obligations exceed earned", () => {
      const limit = calculateEwaWithdrawalLimit(
        10_000_000,
        5,
        30,
        50,
        3_000_000,
        0
      );

      expect(limit.availableLimit).toBe(0);
    });
  });
});
