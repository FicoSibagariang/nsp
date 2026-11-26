import { expect, test, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { EwaTab } from "./EwaTab";
import type { MemberProfile, EwaQuota, EwaHistoryItem } from "../types";

describe("EwaTab Component - Payroll Deduction Summary (#335)", () => {
  afterEach(() => {
    cleanup();
  });

  const dummyProfile: MemberProfile = {
    id: "mem-1",
    name: "Budi Santoso",
    email: "budi@example.com",
    isCoopMember: true,
  };

  const dummyQuota: EwaQuota = {
    maxMonthlyLimit: 5000000,
    remainingQuota: 2000000,
    dailyAccumulatedLimit: 3000000,
    totalUsedThisMonth: 1800000,
    totalPayrollDeductionThisMonth: 1537500,
    totalDisbursedThisMonth: 1500000,
    totalFeeThisMonth: 37500,
    pendingPayrollDeductionThisMonth: 307500,
    currentDayInCycle: 15,
    totalDaysInCycle: 31,
    cycleStartDate: "2026-10-26",
    cycleEndDate: "2026-11-25",
    isEligible: true,
    isMember: true,
  };

  const dummyHistory: EwaHistoryItem[] = [
    {
      id: "ewa-1",
      createdAt: "2026-11-02T10:00:00Z",
      destinationBank: "Bank BCA",
      destinationAccount: "9988776655",
      disbursedAmount: 1000000,
      feeAmount: 25000,
      feePercentage: 2.5,
      totalPayrollDeduction: 1025000,
      status: "DISBURSED",
    },
  ];

  test("renders 'Total Potong Payroll Siklus Ini' card with breakdown and pending note", () => {
    render(
      <EwaTab
        profile={dummyProfile}
        ewaQuota={dummyQuota}
        ewaHistory={dummyHistory}
        feeTiers={[]}
        ewaLoading={false}
        ewaAmount=""
        setEwaAmount={() => {}}
        ewaSubmitLoading={false}
        ewaError=""
        ewaSuccess=""
        onApplyEwa={() => {}}
      />
    );

    // Card title
    expect(screen.getByText("Total Potong Payroll Siklus Ini")).toBeDefined();

    // Main deduction amount: Rp 1.537.500
    expect(screen.getByText("Rp 1.537.500")).toBeDefined();

    // Breakdown subtext: Pokok Rp 1.500.000 + Biaya Admin Rp 37.500
    expect(screen.getByText(/Pokok Rp 1\.500\.000 \+ Biaya Admin Rp 37\.500/i)).toBeDefined();

    // Cycle range
    expect(screen.getAllByText(/Siklus: 2026-10-26 s\/d 2026-11-25/i).length).toBeGreaterThanOrEqual(1);

    // Pending deduction note: + Rp 307.500 masih menunggu pencairan
    expect(screen.getByText(/\+ Rp 307\.500 masih menunggu pencairan/i)).toBeDefined();
  });

  test("does not show pending note when pendingPayrollDeductionThisMonth is 0", () => {
    const quotaWithoutPending: EwaQuota = {
      ...dummyQuota,
      pendingPayrollDeductionThisMonth: 0,
    };

    render(
      <EwaTab
        profile={dummyProfile}
        ewaQuota={quotaWithoutPending}
        ewaHistory={dummyHistory}
        feeTiers={[]}
        ewaLoading={false}
        ewaAmount=""
        setEwaAmount={() => {}}
        ewaSubmitLoading={false}
        ewaError=""
        ewaSuccess=""
        onApplyEwa={() => {}}
      />
    );

    expect(screen.queryByText(/masih menunggu pencairan/i)).toBeNull();
  });
});
