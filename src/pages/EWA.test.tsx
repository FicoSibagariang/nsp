import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EWA from "./EWA";
import * as authModule from "../hooks/useAuth";
import * as configModule from "../config";

describe("EWA Component Permissions & Tabs", () => {
  let authSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(configModule, "apiFetch").mockImplementation((_url: string) => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
        }),
      } as any);
    });
  });

  afterEach(() => {
    cleanup();
    authSpy?.mockRestore?.();
    fetchSpy?.mockRestore?.();
  });

  test("hides Master Karyawan & Gaji tab and import button for viewer role", async () => {
    authSpy = spyOn(authModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      role: "viewer",
      isAdmin: false,
      isSuperAdmin: false,
      hasPermission: (perm: string) =>
        ["read:stats", "read:members", "read:loans", "read:shu", "read:settings"].includes(perm),
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <EWA />
        </MemoryRouter>
      );
    });

    // Tab Pengajuan & Pencairan should be visible
    expect(screen.getByText("Pengajuan & Pencairan")).toBeDefined();
    expect(screen.getByText("Rekap Potongan Payroll (HRD)")).toBeDefined();
    expect(screen.getByText("Tarif Biaya Admin")).toBeDefined();

    // Tab Master Karyawan & Gaji must NOT be present
    expect(screen.queryByText("Master Karyawan & Gaji")).toBeNull();

    // Import button must NOT be present
    expect(screen.queryByText("Import Data Karyawan (CSV)")).toBeNull();
  });

  test("shows Master Karyawan & Gaji tab and import button for admin role", async () => {
    authSpy = spyOn(authModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      role: "admin",
      isAdmin: true,
      isSuperAdmin: false,
      hasPermission: (perm: string) =>
        ["approve:loans", "create:members", "read:loans", "read:members", "read:reports", "read:settings", "update:settings"].includes(perm),
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <EWA />
        </MemoryRouter>
      );
    });

    // Tab Master Karyawan & Gaji should be present
    const empTab = screen.getByText("Master Karyawan & Gaji");
    expect(empTab).toBeDefined();

    // Switch to employees tab
    await act(async () => {
      fireEvent.click(empTab);
    });

    // Import Data Karyawan (CSV) button should be visible
    expect(screen.getByText("Import Data Karyawan (CSV)")).toBeDefined();
  });

  test("renders 'Ekspor XLSX untuk HRD' button and calls export with paycycle filename", async () => {
    authSpy = spyOn(authModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      role: "admin",
      isAdmin: true,
      isSuperAdmin: false,
      hasPermission: () => true,
    } as any);

    const mockPayrollRecap = {
      periodMonth: "2026-09",
      totalEmployees: 1,
      totalDisbursed: 1000000,
      totalFee: 35000,
      totalDeduction: 1035000,
      isFullySettled: false,
      items: [
        {
          employeeId: "emp-1",
          nip: "0201324",
          nik: "1271082604820001",
          name: "Irvansyah Putra Nasution",
          department: "IT",
          isMember: true,
          txCount: 1,
          totalAdvances: 1000000,
          totalFee: 35000,
          totalDeduction: 1035000,
          status: "DISBURSED",
        },
      ],
    };

    fetchSpy?.mockRestore?.();
    fetchSpy = spyOn(configModule, "apiFetch").mockImplementation((url: string) => {
      if (url.includes("/api/v1/ewa/payroll/recap")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockPayrollRecap,
          }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          total: 0,
        }),
      } as any);
    });

    const exportUtilsModule = await import("../utils/exportUtils");
    const exportSpy = spyOn(exportUtilsModule, "exportEwaPayrollToExcel").mockImplementation(() => {});

    try {
      await act(async () => {
        render(
          <MemoryRouter>
            <EWA />
          </MemoryRouter>
        );
      });

      // Switch to tab Rekap Potongan Payroll (HRD)
      const payrollTab = screen.getByText("Rekap Potongan Payroll (HRD)");
      await act(async () => {
        fireEvent.click(payrollTab);
      });

      // Button must be "Ekspor XLSX untuk HRD"
      const exportBtn = screen.getByText("Ekspor XLSX untuk HRD");
      expect(exportBtn).toBeDefined();
      expect(screen.queryByText("Ekspor CSV untuk HRD")).toBeNull();

      // Trigger click
      await act(async () => {
        fireEvent.click(exportBtn);
      });

      expect(exportSpy).toHaveBeenCalledTimes(1);
      const callArgs = (exportSpy.mock.calls as any)[0];
      const itemsArg = callArgs[0];
      const optionsArg = callArgs[1];

      expect(itemsArg[0].nip).toBe("0201324");
      expect(itemsArg[0].name).toBe("Irvansyah Putra Nasution");
      expect(optionsArg.companyName).toBe("PT Media Antar Nusa");
      expect(optionsArg.filename).toContain("ewa-repayment-");
      expect(optionsArg.filename).toContain(".xlsx");
    } finally {
      exportSpy.mockRestore();
    }
  });
});
