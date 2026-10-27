import { expect, test, describe, spyOn } from "bun:test";
import * as XLSX from "xlsx";
import {
  getEwaPaycycleDates,
  exportEwaPayrollToExcel,
  type EwaPayrollExportItem,
} from "./exportUtils";

describe("EWA Payroll XLSX Export Utilities", () => {
  describe("getEwaPaycycleDates", () => {
    test("calculates correct start (26th prev month) and end (25th cur month) for standard month", () => {
      const dates = getEwaPaycycleDates("2026-09");
      expect(dates.startDate).toBe("2026-08-26");
      expect(dates.endDate).toBe("2026-09-25");
      expect(dates.label).toBe("2026-08-26 s/d 2026-09-25");
    });

    test("handles January correctly across year boundary", () => {
      const dates = getEwaPaycycleDates("2026-01");
      expect(dates.startDate).toBe("2025-12-26");
      expect(dates.endDate).toBe("2026-01-25");
      expect(dates.label).toBe("2025-12-26 s/d 2026-01-25");
    });

    test("handles December correctly", () => {
      const dates = getEwaPaycycleDates("2026-12");
      expect(dates.startDate).toBe("2026-11-26");
      expect(dates.endDate).toBe("2026-12-25");
      expect(dates.label).toBe("2026-11-26 s/d 2026-12-25");
    });
  });

  describe("exportEwaPayrollToExcel", () => {
    test("creates workbook with exact HRIS/Wagely Repayment Summary Report format", () => {
      let capturedWorkbook: XLSX.WorkBook | null = null;
      let capturedFilename: string | null = null;

      const writeFileSpy = spyOn(XLSX, "writeFile").mockImplementation((wb: any, fn: any) => {
        capturedWorkbook = wb;
        capturedFilename = fn;
        return undefined as any;
      });

      try {
        const testItems: EwaPayrollExportItem[] = [
          {
            employeeId: "1",
            nip: "0201324",
            nik: "1271082604820001",
            name: "Irvansyah Putra Nasution",
            totalAdvances: 1000000,
            txCount: 1,
            totalFee: 35000,
            totalDeduction: 1035000,
          },
          {
            employeeId: "2",
            nip: "0202202",
            nik: "1271060404960002",
            name: "Ryan Fajar Effendy",
            totalAdvances: 1000000,
            txCount: 3,
            totalFee: 45000,
            totalDeduction: 1045000,
          },
        ];

        exportEwaPayrollToExcel(testItems, {
          companyName: "PT Media Antar Nusa",
          paycycleLabel: "2026-08-26 s/d 2026-09-25",
          filename: "ewa-repayment-2026-08-26-sd-2026-09-25.xlsx",
        });

        expect(writeFileSpy).toHaveBeenCalledTimes(1);
        expect(capturedFilename).toBe("ewa-repayment-2026-08-26-sd-2026-09-25.xlsx");
        expect(capturedWorkbook).not.toBeNull();

        const sheetNames = capturedWorkbook!.SheetNames;
        expect(sheetNames).toEqual(["Repayment Summary Report"]);

        const sheet = capturedWorkbook!.Sheets["Repayment Summary Report"];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Row 0: Company name
        expect(rows[0][0]).toBe("PT Media Antar Nusa");

        // Row 1: Document title
        expect(rows[1][0]).toBe("Repayment Summary Report");

        // Row 2: Paycycle date
        expect(rows[2][0]).toBe("Paycycle Date");
        expect(rows[2][1]).toBe("2026-08-26 s/d 2026-09-25");

        // Row 3: Headers
        expect(rows[3]).toEqual([
          "Employee ID",
          "KTP ID",
          "First Name",
          "Last Name",
          "EWA Amount",
          "#EWA",
          "Membership Fee (Employee)",
          "Membership Fee Discount",
          "Employer Contribution Fee",
          "Membership Fee Total",
          "VAT Total",
          "Total Deduction Amount",
          "Total Repayment",
          "EWA",
          "GB",
          "Arisan",
        ]);

        // Row 4: First employee
        expect(rows[4][0]).toBe("0201324");
        expect(rows[4][1]).toBe("1271082604820001");
        expect(rows[4][2]).toBe("Irvansyah Putra Nasution");
        expect(rows[4][4]).toBe(1000000);
        expect(rows[4][5]).toBe(1);
        expect(rows[4][6]).toBe(35000);
        expect(rows[4][9]).toBe(35000);
        expect(rows[4][11]).toBe(1035000);
        expect(rows[4][12]).toBe(1035000);
        expect(rows[4][13]).toBe(1035000);

        // Row 5: Second employee
        expect(rows[5][0]).toBe("0202202");
        expect(rows[5][1]).toBe("1271060404960002");
        expect(rows[5][2]).toBe("Ryan Fajar Effendy");
        expect(rows[5][4]).toBe(1000000);
        expect(rows[5][5]).toBe(3);
        expect(rows[5][6]).toBe(45000);
        expect(rows[5][11]).toBe(1045000);

        // Row 6: Total row
        expect(rows[6][3]).toBe("Total");
        expect(rows[6][4]).toBe(2000000); // 1.000.000 + 1.000.000
        expect(rows[6][6]).toBe(80000);   // 35.000 + 45.000
        expect(rows[6][9]).toBe(80000);
        expect(rows[6][11]).toBe(2080000); // 1.035.000 + 1.045.000
        expect(rows[6][12]).toBe(2080000);
        expect(rows[6][13]).toBe(2080000);
      } finally {
        writeFileSpy.mockRestore();
      }
    });
  });
});
