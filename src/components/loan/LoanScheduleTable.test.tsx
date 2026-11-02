import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LoanScheduleTable } from "./LoanScheduleTable";

const sampleSchedule = [
  {
    id: "sch-1",
    installmentNo: 1,
    dueDate: "2026-10-31",
    principalAmount: 2000000,
    interestAmount: 150000,
    paidAmount: 2150000,
    status: "Paid",
  },
  {
    id: "sch-2",
    installmentNo: 2,
    dueDate: "2026-11-30",
    principalAmount: 2000000,
    interestAmount: 100000,
    paidAmount: 0,
    status: "Pending",
  },
  {
    id: "sch-3",
    installmentNo: 3,
    dueDate: "2026-12-31",
    principalAmount: 2000000,
    interestAmount: 50000,
    paidAmount: 0,
    status: "Pending",
  },
];

describe("LoanScheduleTable (Issue #311)", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders 'Total Angsuran' header instead of 'Tagihan' in view mode", () => {
    render(
      <LoanScheduleTable
        loanId="loan-123"
        pokok={6000000}
        interestRate={18}
        schedule={sampleSchedule}
        scheduleLoading={false}
        canEditSchedule={true}
        isSubmitting={false}
        onSaved={() => {}}
      />
    );

    expect(screen.getByText("Total Angsuran")).toBeDefined();
    expect(screen.queryByText("Tagihan")).toBeNull();
  });

  it("renders table footer with totals in view mode", () => {
    render(
      <LoanScheduleTable
        loanId="loan-123"
        pokok={6000000}
        interestRate={18}
        schedule={sampleSchedule}
        scheduleLoading={false}
        canEditSchedule={true}
        isSubmitting={false}
        onSaved={() => {}}
      />
    );

    // Footer summary row
    expect(screen.getByText("Total")).toBeDefined();
    // Total Pokok = 6.000.000
    // Total Admin = 300.000
    // Total Angsuran = 6.300.000
    expect(screen.getAllByText("Rp 6.000.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 300.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 6.300.000").length).toBeGreaterThan(0);
  });

  it("renders 'Total Angsuran' column and dynamic computation in edit mode", () => {
    render(
      <LoanScheduleTable
        loanId="loan-123"
        pokok={6000000}
        interestRate={18}
        schedule={sampleSchedule}
        scheduleLoading={false}
        canEditSchedule={true}
        isSubmitting={false}
        onSaved={() => {}}
      />
    );

    // Switch to edit mode
    const editBtn = screen.getByRole("button", { name: "Edit Jadwal" });
    fireEvent.click(editBtn);

    // Verify Total Angsuran header exists in edit mode table
    expect(screen.getByText("Total Angsuran")).toBeDefined();

    // Verify footer exists in edit mode
    expect(screen.getByText("Total")).toBeDefined();
    expect(screen.getAllByText("Rp 6.300.000").length).toBeGreaterThan(0);

    // Edit row 1 principal amount
    const inputs = screen.getAllByRole("textbox");
    // Find principal input for installment 1 (currently "2.000.000")
    const principalInput = inputs.find((inp: any) => inp.value === "2.000.000");
    expect(principalInput).toBeDefined();

    fireEvent.change(principalInput!, { target: { value: "3000000" } });

    // Row 1 total should now be 3.000.000 + 150.000 = Rp 3.150.000
    expect(screen.getByText("Rp 3.150.000")).toBeDefined();
  });
});
