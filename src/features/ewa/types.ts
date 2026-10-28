export type { CompanyEmployee, EWARequest, EwaFeeTier } from '@shared/types';

export interface PaymentSourceAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface PayrollRecapItem {
  employeeId: string;
  name: string;
  department?: string;
  totalTransactions: number;
  totalDeduction: number;
  principalAmount?: number;
  feeAmount?: number;
  transactions?: Array<{
    id: string;
    date: string;
    amount: number;
    fee: number;
    total: number;
  }>;
}

export interface PayrollRecapData {
  month: string;
  startDate?: string;
  endDate?: string;
  totalEmployees: number;
  totalTransactions: number;
  totalDisbursed: number;
  totalFee: number;
  totalDeduction: number;
  isSettled?: boolean;
  settledAt?: string;
  items: PayrollRecapItem[];
}
