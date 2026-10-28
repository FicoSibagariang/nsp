import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MemberPortal from "./MemberPortal";
import { ThemeProvider } from "../contexts/ThemeContext";

describe("MemberPortal", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  test("renders login form when no memberToken is stored", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <MemoryRouter>
            <MemberPortal />
          </MemoryRouter>
        </ThemeProvider>
      );
    });

    expect(screen.getByText("Portal Anggota")).toBeDefined();
    expect(screen.getByText("ID Anggota / Email")).toBeDefined();
    expect(screen.getByText("Kata Sandi")).toBeDefined();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeDefined();
  });

  test("renders portal layout and tabs when memberToken exists", async () => {
    localStorage.setItem("memberToken", "fake-member-token");

    const fetchSpy = (spyOn(globalThis, "fetch") as any).mockImplementation((url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v1/portal/profile")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "m-1",
              name: "Budi Santoso",
              memberId: "ANG-001",
              totalSavings: 5000000,
              simpananPokok: 500000,
              simpananWajib: 1500000,
              simpananSukarela: 3000000,
              isCoopMember: true,
              canViewShu: true,
            },
          }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      } as any);
    });

    try {
      await act(async () => {
        render(
          <ThemeProvider>
            <MemoryRouter>
              <MemberPortal />
            </MemoryRouter>
          </ThemeProvider>
        );
      });

      expect(screen.getByText("Selamat Datang, Budi Santoso")).toBeDefined();
      expect(screen.getByText("No. Anggota: ANG-001")).toBeDefined();
      expect(screen.getByText("Simpanan")).toBeDefined();
      expect(screen.getByText("Pinjaman")).toBeDefined();
      expect(screen.getByText("Gaji Awal (EWA)")).toBeDefined();
      expect(screen.getByText("SHU & Proyeksi")).toBeDefined();
      expect(screen.getByText("Laporan Keuangan")).toBeDefined();

      // Open deposit form
      const depositBtn = screen.getByText("+ Konfirmasi Setoran Transfer");
      await act(async () => {
        fireEvent.click(depositBtn);
      });
      expect(screen.getByText("Konfirmasi Setoran Simpanan (Transfer Bank)")).toBeDefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("renders non-member EWA portal view when isCoopMember is false", async () => {
    localStorage.setItem("memberToken", "fake-employee-token");

    const fetchSpy = (spyOn(globalThis, "fetch") as any).mockImplementation((url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v1/portal/profile")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "emp-1",
              name: "Siti Rahma",
              isCoopMember: false,
              employee: {
                bankName: "Bank Mandiri",
                bankAccountNumber: "1234567890",
              },
            },
          }),
        } as any);
      }
      if (urlStr.includes("/api/v1/portal/ewa/quota")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              maxMonthlyLimit: 3000000,
              remainingQuota: 1500000,
              totalUsedThisMonth: 500000,
            },
          }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      } as any);
    });

    try {
      await act(async () => {
        render(
          <ThemeProvider>
            <MemoryRouter>
              <MemberPortal />
            </MemoryRouter>
          </ThemeProvider>
        );
      });

      expect(screen.getByText("Karyawan Perusahaan Induk")).toBeDefined();
      expect(screen.getByText("Non-Anggota Koperasi")).toBeDefined();
      expect(screen.getByText("Fasilitas Akses Gaji Awal (EWA)")).toBeDefined();
      // Should not show savings/loans tabs for non-members
      expect(screen.queryByText("Simpanan")).toBeNull();
      expect(screen.queryByText("Pinjaman")).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
