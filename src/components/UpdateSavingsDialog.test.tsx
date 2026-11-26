import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UpdateSavingsDialogContent } from "./UpdateSavingsDialog";
import * as apiQueryModule from "../hooks/useApiQuery";

describe("UpdateSavingsDialogContent component (#333)", () => {
  let apiQuerySpy: any;

  beforeEach(() => {
    apiQuerySpy = spyOn(apiQueryModule, "useApiQuery").mockImplementation((url: string) => {
      if (url === "/api/savings/payment-sources") {
        return {
          data: {
            success: true,
            data: [
              { id: "acc-mandiri", code: "11102", name: "Bank Mandiri", type: "ASSET" },
              { id: "acc-kaskecil", code: "11101", name: "Kas Kecil", type: "ASSET" },
            ],
          },
        } as any;
      }
      return { data: null } as any;
    });
  });

  afterEach(() => {
    cleanup();
    apiQuerySpy?.mockRestore?.();
  });

  it("renders Rekening Kas / Bank selector defaulting to Bank Mandiri (11102)", () => {
    const onSaveMock = mock(() => {});
    const onCloseMock = mock(() => {});

    render(<UpdateSavingsDialogContent onClose={onCloseMock} onSave={onSaveMock} />);

    expect(screen.getByText("Rekening Kas / Bank")).toBeTruthy();
    expect(screen.getAllByText("Bank Mandiri (11102)").length).toBeGreaterThanOrEqual(1);
  });

  it("submits default paymentSourceAccountId when not changed", () => {
    const onSaveMock = mock(() => {});
    const onCloseMock = mock(() => {});

    render(<UpdateSavingsDialogContent onClose={onCloseMock} onSave={onSaveMock} />);

    // Fill nominal
    const amountInput = screen.getByLabelText("Nominal (Rp)");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    // Click Simpan
    const saveBtn = screen.getByRole("button", { name: "Simpan" });
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledTimes(1);
    const payload = (onSaveMock.mock.calls as any)[0]?.[0];
    expect(payload.additionalSavings).toBe(500000);
    expect(payload.paymentSourceAccountId).toBe("acc-mandiri");
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("allows selecting Kas Kecil (11101) and passes its accountId on submit", () => {
    const onSaveMock = mock(() => {});
    const onCloseMock = mock(() => {});

    render(<UpdateSavingsDialogContent onClose={onCloseMock} onSave={onSaveMock} />);

    // Select Kas Kecil by clicking option
    const kasKecilElements = screen.getAllByText("Kas Kecil (11101)");
    fireEvent.click(kasKecilElements[0]);

    // Fill nominal (penarikan)
    const amountInput = screen.getByLabelText("Nominal (Rp)");
    fireEvent.change(amountInput, { target: { value: "-100000" } });

    // Click Simpan
    const saveBtn = screen.getByRole("button", { name: "Simpan" });
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledTimes(1);
    const payload = (onSaveMock.mock.calls as any)[0]?.[0];
    expect(payload.additionalSavings).toBe(-100000);
    expect(payload.paymentSourceAccountId).toBe("acc-kaskecil");
  });
});
