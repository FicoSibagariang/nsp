import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { LoanPayrollDeductionDialogContent } from "./LoanPayrollDeductionDialog";
import { DemoModeProvider } from "../contexts/DemoModeContext";
import { api } from "../services/api";
import * as exportUtilsModule from "../utils/exportUtils";

describe("LoanPayrollDeductionDialogComponent", () => {
  let apiGetSpy: any;
  let exportSpy: any;

  const mockData = {
    month: "2026-09",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    totalEmployees: 2,
    totalAmount: 1144976,
    items: [
      {
        employeeId: "0202169",
        name: "Abdul Aziz Laia",
        memberId: "mem-1",
        loanCount: 1,
        amount: 548520,
        principalAmount: 513215,
        interestAmount: 35305,
        currentAmount: 0,
        newAmount: 548520,
        note: "",
      },
      {
        employeeId: "02025118",
        name: "Ahmad Iqrom Harahap",
        memberId: "mem-2",
        loanCount: 1,
        amount: 596456,
        principalAmount: 524534,
        interestAmount: 71922,
        currentAmount: 0,
        newAmount: 596456,
        note: "",
      },
    ],
  };

  beforeEach(() => {
    apiGetSpy = spyOn(api, "get").mockImplementation((url: string) => {
      if (url.includes("/api/loans/payroll-deductions")) {
        return Promise.resolve(mockData as any);
      }
      return Promise.resolve([] as any);
    });

    exportSpy = spyOn(exportUtilsModule, "exportLoanPayrollDeductionsToExcel").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    apiGetSpy?.mockRestore?.();
    exportSpy?.mockRestore?.();
  });

  test("renders preview table, summary cards, and allows downloading XLSX", async () => {
    const handleClose = spyOn({ fn: () => {} }, "fn");

    await act(async () => {
      render(<LoanPayrollDeductionDialogContent onClose={handleClose} />);
    });

    // Verify title and subtitle
    expect(screen.getByText("Ekspor Potong Gaji Angsuran (HRIS)")).toBeDefined();

    // Verify summary statistics
    expect(screen.getByText("2 Orang")).toBeDefined();

    // Verify preview rows
    expect(screen.getByText("Abdul Aziz Laia")).toBeDefined();
    expect(screen.getByText("0202169")).toBeDefined();
    expect(screen.getByText("Ahmad Iqrom Harahap")).toBeDefined();
    expect(screen.getByText("02025118")).toBeDefined();

    // Verify api.get was called on mount
    expect(apiGetSpy).toHaveBeenCalledTimes(1);

    // Click download button (runs synchronously matching /ewa)
    const downloadBtn = screen.getByText("Unduh Berkas XLSX");
    expect(downloadBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(exportSpy).toHaveBeenCalledTimes(1);
    const callArgs = (exportSpy.mock.calls as any)[0];
    const itemsArg = callArgs[0];
    const filenameArg = callArgs[1];

    expect(itemsArg.length).toBe(2);
    expect(itemsArg[0].employeeId).toBe("0202169");
    expect(itemsArg[0].name).toBe("Abdul Aziz Laia");
    expect(itemsArg[0].newAmount).toBe(548520);
    expect(filenameArg).toContain("potong_gaji_angsuran_");
    expect(filenameArg).toContain(".xlsx");
  });

  test("masks employee ID and name when Demo Mode is active", async () => {
    // Enable demo mode in localStorage
    localStorage.setItem("demo-mode", "true");

    try {
      await act(async () => {
        render(
          <DemoModeProvider>
            <LoanPayrollDeductionDialogContent onClose={() => {}} />
          </DemoModeProvider>
        );
      });

      // Real names must NOT appear
      expect(screen.queryByText("Abdul Aziz Laia")).toBeNull();
      expect(screen.queryByText("0202169")).toBeNull();

      // Download must receive masked values via exportUtils
      const downloadBtn = screen.getByText("Unduh Berkas XLSX");
      await act(async () => {
        fireEvent.click(downloadBtn);
      });

      expect(exportSpy).toHaveBeenCalledTimes(1);
      const callArgs = (exportSpy.mock.calls as any)[0];
      const itemsArg = callArgs[0];

      expect(itemsArg[0].name).not.toBe("Abdul Aziz Laia");
      expect(itemsArg[0].employeeId).not.toBe("0202169");
      expect(itemsArg[0].newAmount).toBe(548520);
    } finally {
      localStorage.removeItem("demo-mode");
    }
  });

  test("displays error message and allows retry when initial fetch fails", async () => {
    apiGetSpy.mockImplementation(() => {
      return Promise.reject(new Error("Network connection error"));
    });

    await act(async () => {
      render(<LoanPayrollDeductionDialogContent onClose={() => {}} />);
    });

    expect(screen.getByText("Gagal memuat pratinjau potongan payroll")).toBeDefined();
    expect(screen.getByText("Network connection error")).toBeDefined();
    expect(screen.getByText("Coba Lagi")).toBeDefined();
  });
});
