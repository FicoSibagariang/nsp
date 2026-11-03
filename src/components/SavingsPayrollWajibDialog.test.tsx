import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { SavingsPayrollWajibDialogContent } from "./SavingsPayrollWajibDialog";
import { DemoModeProvider } from "../contexts/DemoModeContext";
import { api } from "../services/api";

describe("SavingsPayrollWajibDialogComponent (Issue #316)", () => {
  let apiGetSpy: any;

  const mockRecapData = {
    periodMonth: "2026-11",
    totalActiveMembers: 2,
    defaultAmountPerMember: 50000,
    alreadyPaidCount: 0,
    pendingCount: 2,
    totalPendingAmount: 100000,
    isSettled: false,
    settledAt: null,
    pendingMembers: [
      {
        id: "mem-test-1",
        name: "Budi Santoso",
        simpananPokok: 500000,
        simpananWajib: 100000,
        simpananSukarela: 50000,
        totalSavings: 650000,
      },
      {
        id: "mem-test-2",
        name: "Siti Rahma",
        simpananPokok: 500000,
        simpananWajib: 150000,
        simpananSukarela: 0,
        totalSavings: 650000,
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    apiGetSpy = spyOn(api, "get").mockImplementation((url: string) => {
      if (url.includes("/api/v1/savings/payroll/recap-wajib")) {
        return Promise.resolve(mockRecapData as any);
      }
      return Promise.resolve([] as any);
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    apiGetSpy?.mockRestore?.();
  });

  test("renders preview table, summary cards, and pending members", async () => {
    const handleClose = spyOn({ fn: () => {} }, "fn");

    await act(async () => {
      render(<SavingsPayrollWajibDialogContent onClose={handleClose} />);
    });

    // Verify title and subtitle
    expect(screen.getByText("Rekap & Pembukuan Simpanan Wajib Payroll")).toBeDefined();

    // Verify summary statistics
    expect(screen.getByText("Total Anggota Aktif")).toBeDefined();
    expect(screen.getByText("2 orang")).toBeDefined();

    // Verify pending members rendered
    expect(screen.getByText("Budi Santoso")).toBeDefined();
    expect(screen.getByText("Siti Rahma")).toBeDefined();
    expect(apiGetSpy).toHaveBeenCalled();
  });

  test("displays settled badge and hides settlement card when isSettled is true", async () => {
    apiGetSpy.mockImplementation(() => {
      return Promise.resolve({
        ...mockRecapData,
        isSettled: true,
        settledAt: "2026-11-30T12:00:00.000Z",
        alreadyPaidCount: 2,
        pendingCount: 0,
        totalPendingAmount: 0,
        pendingMembers: [],
      } as any);
    });

    await act(async () => {
      render(<SavingsPayrollWajibDialogContent onClose={() => {}} />);
    });

    // Settled badge must be visible
    expect(screen.getByText("✅ Simpanan Wajib Periode Ini Sudah Lengkap Dibukukan")).toBeDefined();

    // Settle button must not be visible
    expect(screen.queryByText(/Bukukan Setoran Simpanan Wajib/)).toBeNull();
  });

  test("opens confirmation and successfully executes 1-click settlement", async () => {
    const postSpy = spyOn(api, "post").mockImplementation(() => {
      return Promise.resolve({
        success: true,
        message: "Berhasil membukukan simpanan wajib payroll untuk 2 anggota (Total: Rp 100.000)",
        data: {
          periodMonth: "2026-11",
          settledMembersCount: 2,
          amountPerMember: 50000,
          totalSettledAmount: 100000,
          journalEntryId: "j-123",
        },
      } as any);
    });

    try {
      await act(async () => {
        render(<SavingsPayrollWajibDialogContent onClose={() => {}} />);
      });

      // Find initial button
      const openConfirmBtn = screen.getByText(/Bukukan Setoran Simpanan Wajib/);
      expect(openConfirmBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(openConfirmBtn);
      });

      // Verify confirmation view
      expect(screen.getByText("Konfirmasi Pembukuan Simpanan Wajib Payroll")).toBeDefined();
      expect(screen.getByText(/• \[DEBIT\] 11102 - Bank Mandiri:/)).toBeDefined();
      expect(screen.getByText(/• \[KREDIT\] 31102 - Simpanan Wajib:/)).toBeDefined();

      // Click confirm & settle
      const confirmBtn = screen.getByText(/Ya, Konfirmasi & Bukukan/);
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(postSpy).toHaveBeenCalled();
      const callArgs = (postSpy.mock.calls as any)[0];
      expect(callArgs[0]).toBe("/api/v1/savings/payroll/settle-wajib");
      expect(callArgs[1].periodMonth).toBe("2026-11");
    } finally {
      postSpy.mockRestore();
    }
  });

  test("masks member names in demo mode", async () => {
    localStorage.setItem("demo-mode", "true");

    try {
      await act(async () => {
        render(
          <DemoModeProvider>
            <SavingsPayrollWajibDialogContent onClose={() => {}} />
          </DemoModeProvider>
        );
      });

      // In demo mode, raw full name should not be displayed directly
      expect(screen.queryByText("Budi Santoso")).toBeNull();
      expect(screen.queryByText("Siti Rahma")).toBeNull();
    } finally {
      localStorage.removeItem("demo-mode");
    }
  });
});
