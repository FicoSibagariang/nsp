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
    fetchSpy = spyOn(configModule, "apiFetch").mockImplementation((url: string) => {
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
});
