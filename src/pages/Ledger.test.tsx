import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import Ledger from "./Ledger";
import { DemoModeContext } from "../contexts/DemoModeContextDef";
import * as apiQueryModule from "../hooks/useApiQuery";

const mockLedgerAccounts = [
  {
    id: "acc-11301",
    code: "11301",
    name: "Piutang Kasbon Karyawan (EWA)",
    type: "ASSET",
    normal_balance: "DEBIT",
    opening_balance: 0,
    total_debit: 500000,
    total_credit: 0,
    balance: 500000,
  },
];

const mockExpandedDetails = {
  account: {
    code: "11301",
    name: "Piutang Kasbon Karyawan (EWA)",
    type: "ASSET",
    normal_balance: "DEBIT",
  },
  openingBalance: 0,
  closingBalance: 500000,
  transactions: [
    {
      id: "tx-1",
      transaction_date: "2026-10-15",
      reference_type: "ewa_disbursement",
      reference_id: "ewa-req-1",
      journal_description: "Pencairan EWA Kasbon Karyawan: Irwan Pancariadi (0202549)",
      line_description: "Pencairan EWA Kasbon Karyawan: Irwan Pancariadi (0202549)",
      debit: 500000,
      credit: 0,
      balance: 500000,
    },
  ],
};

describe("Ledger Page Privacy Masking (Issue #312)", () => {
  let apiQuerySpy: any;

  beforeEach(() => {
    cleanup();
    apiQuerySpy = spyOn(apiQueryModule, "useApiQuery").mockImplementation((url: string) => {
      if (url.includes("/api/accounting/ledger/acc-11301")) {
        return {
          data: mockExpandedDetails,
          isLoading: false,
          error: null,
          refetch: () => {},
        } as any;
      }
      return {
        data: mockLedgerAccounts,
        isLoading: false,
        error: null,
        refetch: () => {},
      } as any;
    });
  });

  afterEach(() => {
    cleanup();
    apiQuerySpy?.mockRestore?.();
  });

  it("masks transaction mutation descriptions in Ledger drill-down when Demo Mode is ACTIVE", () => {
    render(
      <DemoModeContext.Provider
        value={{
          isDemoMode: true,
          toggleDemoMode: () => {},
          setDemoMode: () => {},
        }}
      >
        <Ledger />
      </DemoModeContext.Provider>
    );

    // Expand the account row to see drill-down mutations
    const accountRow = screen.getByText("Piutang Kasbon Karyawan (EWA)");
    fireEvent.click(accountRow);

    // Real PII should not be present
    expect(screen.queryByText(/Irwan Pancariadi/)).toBeNull();
    expect(screen.queryByText(/0202549/)).toBeNull();

    // Masked format should appear
    expect(screen.getByText(/Pencairan EWA Kasbon Karyawan:/)).toBeDefined();
    expect(screen.getByText(/EMP-\d{4}/)).toBeDefined();
  });

  it("displays real mutation descriptions in Ledger drill-down when Demo Mode is INACTIVE", () => {
    render(
      <DemoModeContext.Provider
        value={{
          isDemoMode: false,
          toggleDemoMode: () => {},
          setDemoMode: () => {},
        }}
      >
        <Ledger />
      </DemoModeContext.Provider>
    );

    // Expand the account row to see drill-down mutations
    const accountRow = screen.getByText("Piutang Kasbon Karyawan (EWA)");
    fireEvent.click(accountRow);

    // Real PII should be present
    expect(screen.getByText(/Irwan Pancariadi \(0202549\)/)).toBeDefined();
  });
});
