import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import Accounting from "./Accounting";
import { DemoModeContext } from "../contexts/DemoModeContextDef";
import * as authModule from "../hooks/useAuth";
import * as infiniteScrollModule from "../hooks/useInfiniteScroll";
import * as apiQueryModule from "../hooks/useApiQuery";

const mockJournalEntries = [
  {
    id: "journal-1",
    transaction_date: "2026-10-15",
    description: "Pencairan EWA Kasbon Karyawan: Irwan Pancariadi (0202549)",
    reference_type: "ewa_disbursement",
    reference_id: "ewa-req-1",
    created_by: "user-admin-1",
    creator_name: "Ramadina",
    lines: [
      {
        id: "line-1",
        account_code: "11301",
        account_name: "Piutang Kasbon Karyawan (EWA)",
        debit: 500000,
        credit: 0,
        description: "Pencairan EWA Kasbon Karyawan: Irwan Pancariadi (0202549)",
      },
      {
        id: "line-2",
        account_code: "11102",
        account_name: "Bank Mandiri",
        debit: 0,
        credit: 500000,
        description: null,
      },
    ],
  },
  {
    id: "journal-2",
    transaction_date: "2026-10-16",
    description: "Setoran Simpanan sukarela — Wardi",
    reference_type: "savings_deposit",
    reference_id: "sav-dep-1",
    created_by: null,
    creator_name: "Sistem",
    lines: [
      {
        id: "line-3",
        account_code: "11102",
        account_name: "Bank Mandiri",
        debit: 1000000,
        credit: 0,
        description: null,
      },
      {
        id: "line-4",
        account_code: "21103",
        account_name: "Simpanan Sukarela",
        debit: 0,
        credit: 1000000,
        description: "Setoran Simpanan sukarela — Wardi",
      },
    ],
  },
];

describe("Accounting Page Privacy Masking (Issue #312)", () => {
  beforeEach(() => {
    cleanup();
    spyOn(authModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      role: "superadmin",
      isAdmin: true,
      isSuperAdmin: true,
      hasPermission: () => true,
    } as any);

    spyOn(infiniteScrollModule, "useInfiniteScroll").mockReturnValue({
      items: mockJournalEntries,
      isLoading: false,
      isFetchingMore: false,
      hasMore: false,
      error: null,
      sentinelRef: () => {},
      refetch: () => {},
    } as any);

    spyOn(apiQueryModule, "useApiQuery").mockReturnValue({
      data: [
        { id: "acc-1", code: "11102", name: "Bank Mandiri", type: "ASSET", normal_balance: "DEBIT" },
      ],
      isLoading: false,
      error: null,
      refetch: () => {},
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("masks PII in journal descriptions and creator names when Demo Mode is ACTIVE", () => {
    render(
      <DemoModeContext.Provider
        value={{
          isDemoMode: true,
          toggleDemoMode: () => {},
          setDemoMode: () => {},
        }}
      >
        <Accounting />
      </DemoModeContext.Provider>
    );

    // EWA employee name and NIP should NOT be visible
    expect(screen.queryByText(/Irwan Pancariadi/)).toBeNull();
    expect(screen.queryByText(/0202549/)).toBeNull();

    // Member name should NOT be visible
    expect(screen.queryByText(/Wardi/)).toBeNull();

    // Admin creator name should NOT be visible
    expect(screen.queryByText(/Ramadina/)).toBeNull();

    // Masked pattern should appear
    expect(screen.getAllByText(/Pencairan EWA Kasbon Karyawan:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/EMP-\d{4}/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Setoran Simpanan sukarela — /).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dicatat oleh: Sistem/)).toBeDefined();
  });

  it("displays real PII when Demo Mode is INACTIVE", () => {
    render(
      <DemoModeContext.Provider
        value={{
          isDemoMode: false,
          toggleDemoMode: () => {},
          setDemoMode: () => {},
        }}
      >
        <Accounting />
      </DemoModeContext.Provider>
    );

    // Real values should be visible
    expect(screen.getAllByText(/Irwan Pancariadi \(0202549\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Setoran Simpanan sukarela — Wardi/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dicatat oleh: Ramadina/)).toBeDefined();
    expect(screen.getByText(/Dicatat oleh: Sistem/)).toBeDefined();
  });

  it("uses masked description in confirmation dialogs when Demo Mode is ACTIVE", () => {
    const confirmSpy = spyOn(window, "confirm").mockReturnValue(false);

    render(
      <DemoModeContext.Provider
        value={{
          isDemoMode: true,
          toggleDemoMode: () => {},
          setDemoMode: () => {},
        }}
      >
        <Accounting />
      </DemoModeContext.Provider>
    );

    const koreksiButtons = screen.getAllByRole("button", { name: "Koreksi" });
    fireEvent.click(koreksiButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    const confirmPrompt = confirmSpy.mock.calls[0][0];
    expect(confirmPrompt).not.toContain("Irwan Pancariadi");
    expect(confirmPrompt).not.toContain("0202549");
    expect(confirmPrompt).toMatch(/Pencairan EWA Kasbon Karyawan: [A-Za-z]+ [A-Za-z]+ \(EMP-\d{4}\)/);
  });
});
