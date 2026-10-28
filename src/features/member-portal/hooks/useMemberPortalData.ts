import { useState, useCallback, useEffect } from 'react';
import type {
  PortalLoan,
  ScheduleRow,
  PaymentRow,
  MemberProfile,
  SavingsTransaction,
  SavingsWithdrawal,
  SavingsDeposit,
  EwaQuota,
  EwaHistoryItem,
  ShuData,
  IncomeData,
  BalanceData,
  CashflowData,
} from '../types';
import type { EwaFeeTier } from '@shared/types';
import { readPortalToken, PREVIEW_TOKEN_KEY } from './usePortalAuth';

export function useMemberPortalData(
  memberToken: string | null,
  clearPreviewSession: () => void,
  setMemberToken: (tok: string | null) => void,
  setActiveTab: (tab: 'savings' | 'loans' | 'shu' | 'reports' | 'ewa') => void
) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loans, setLoans] = useState<PortalLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<PortalLoan | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // SHU State
  const [shuData, setShuData] = useState<ShuData | null>(null);
  const [shuLoading, setShuLoading] = useState(false);
  const [shuYear, setShuYear] = useState(() => new Date().getFullYear().toString());
  const [shuError, setShuError] = useState('');

  // Voluntary Savings Withdrawal & Deposit States
  const [savingsWithdrawals, setSavingsWithdrawals] = useState<SavingsWithdrawal[]>([]);
  const [savingsDeposits, setSavingsDeposits] = useState<SavingsDeposit[]>([]);

  // EWA State
  const [ewaQuota, setEwaQuota] = useState<EwaQuota | null>(null);
  const [ewaHistory, setEwaHistory] = useState<EwaHistoryItem[]>([]);
  const [feeTiers, setFeeTiers] = useState<EwaFeeTier[]>([]);
  const [ewaLoading, setEwaLoading] = useState(false);
  const [ewaAmount, setEwaAmount] = useState('');
  const [ewaSubmitLoading, setEwaSubmitLoading] = useState(false);
  const [ewaError, setEwaError] = useState('');
  const [ewaSuccess, setEwaSuccess] = useState('');

  // Reports State
  const [incomeData, setIncomeData] = useState<IncomeData | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [cashflowData, setCashflowData] = useState<CashflowData | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const loadEwaData = useCallback(async () => {
    const token = readPortalToken();
    if (!token) return;
    setEwaLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [quotaRes, histRes, tiersRes] = await Promise.all([
        fetch('/api/v1/portal/ewa/quota', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/ewa/history', { headers }).then((r) => r.json()),
        fetch('/api/v1/ewa/fee-tiers').then((r) => r.json()).catch(() => ({ success: false })),
      ]);
      if (quotaRes.success) {
        setEwaQuota(quotaRes.data);
        if (quotaRes.data?.feeTiers && Array.isArray(quotaRes.data.feeTiers)) {
          setFeeTiers(quotaRes.data.feeTiers);
        }
      }
      if (histRes.success) {
        setEwaHistory(histRes.data || []);
      }
      if (tiersRes.success && (!quotaRes?.data?.feeTiers || quotaRes.data.feeTiers.length === 0)) {
        setFeeTiers(tiersRes.data || []);
      }
    } catch {
      // ignore
    } finally {
      setEwaLoading(false);
    }
  }, []);

  const handleApplyEwa = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;
    setEwaSubmitLoading(true);
    setEwaError('');
    setEwaSuccess('');
    try {
      const numericAmount = parseFloat(ewaAmount.replace(/\D/g, '')) || 0;
      const res = await fetch('/api/v1/portal/ewa/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numericAmount,
          destinationBank: ewaQuota?.employee?.bankName,
          destinationAccount: ewaQuota?.employee?.bankAccountNumber,
          destinationName: ewaQuota?.employee?.bankAccountName || ewaQuota?.employee?.name,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setEwaSuccess(res.message || 'Pengajuan penarikan gaji awal berhasil dikirim!');
        setEwaAmount('');
        loadEwaData();
        setTimeout(() => setEwaSuccess(''), 4000);
      } else {
        setEwaError(res.message || 'Gagal mengajukan penarikan EWA');
      }
    } catch {
      setEwaError('Terjadi kesalahan jaringan');
    } finally {
      setEwaSubmitLoading(false);
    }
  };

  const loadReports = useCallback(async () => {
    const token = readPortalToken();
    if (!token) return;
    setReportsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [incRes, balRes, cfRes] = await Promise.all([
        fetch('/api/v1/portal/reports/income-statement', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/reports/balance-sheet', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/reports/cashflow-statement', { headers }).then((r) => r.json()),
      ]);
      if (incRes.success) setIncomeData(incRes.data);
      if (balRes.success) setBalanceData(balRes.data);
      if (cfRes.success) setCashflowData(cfRes.data);
    } catch {
      setError('Gagal memuat laporan keuangan');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadShuData = useCallback(async (targetYear?: string) => {
    const token = readPortalToken();
    if (!token) return;
    const yearToFetch = targetYear || shuYear || new Date().getFullYear().toString();
    setShuLoading(true);
    setShuError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/v1/portal/shu?year=${yearToFetch}`, { headers }).then((r) => r.json());
      if (res.success) {
        setShuData(res.data);
        if (res.data.year) setShuYear(res.data.year);
      } else {
        setShuError(res.message || 'Gagal memuat informasi SHU');
      }
    } catch {
      setShuError('Terjadi kesalahan jaringan saat memuat informasi SHU');
    } finally {
      setShuLoading(false);
    }
  }, [shuYear]);

  const loadData = useCallback(async () => {
    const token = readPortalToken();
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, txRes, loansRes, withdrawalsRes, depositsRes] = await Promise.all([
        fetch('/api/v1/portal/profile', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/savings/transactions', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/loans', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/savings/withdrawals', { headers }).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/v1/portal/savings/deposits', { headers }).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      ]);

      if (profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
        if (profileRes.data.isCoopMember === false) {
          setActiveTab('ewa');
        }
      }
      if (txRes.success) setTransactions(txRes.data || []);
      if (withdrawalsRes.success) setSavingsWithdrawals(withdrawalsRes.data || []);
      if (depositsRes?.success) setSavingsDeposits(depositsRes.data || []);
      if (loansRes.success) {
        setLoans(loansRes.data || []);
      } else if (loansRes.message) {
        setError(loansRes.message || 'Gagal memuat data pinjaman');
      }

      loadEwaData();
      if (!profileRes.success) {
        setError(profileRes.message || 'Sesi berakhir, silakan masuk lagi');
        if (sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
          clearPreviewSession();
        } else {
          localStorage.removeItem('memberToken');
        }
        setMemberToken(null);
      }
    } catch {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [clearPreviewSession, loadEwaData, setActiveTab, setMemberToken]);

  useEffect(() => {
    if (memberToken) {
      loadData();
    }
  }, [memberToken, loadData]);

  const loadSchedule = async (loan: PortalLoan) => {
    const token = readPortalToken();
    if (!token) return;
    setSelectedLoan(loan);
    setScheduleLoading(true);
    setPaymentsLoading(true);
    setSchedule([]);
    setPayments([]);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [schedRes, payRes] = await Promise.all([
        fetch(`/api/v1/portal/loans/${loan.id}/schedule`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/portal/loans/${loan.id}/payments`, { headers }).then((r) => r.json()),
      ]);

      if (schedRes.success) {
        setSchedule(schedRes.data || []);
      } else {
        setError(schedRes.message || 'Gagal memuat jadwal angsuran');
      }

      if (payRes.success) {
        setPayments(payRes.data || []);
      }
    } catch {
      setError('Gagal memuat detail pinjaman');
    } finally {
      setScheduleLoading(false);
      setPaymentsLoading(false);
    }
  };

  return {
    profile,
    transactions,
    loans,
    selectedLoan,
    setSelectedLoan,
    schedule,
    setSchedule,
    scheduleLoading,
    payments,
    paymentsLoading,
    loading,
    error,
    shuData,
    shuLoading,
    shuYear,
    setShuYear,
    shuError,
    savingsWithdrawals,
    savingsDeposits,
    ewaQuota,
    ewaHistory,
    feeTiers,
    ewaLoading,
    ewaAmount,
    setEwaAmount,
    ewaSubmitLoading,
    ewaError,
    ewaSuccess,
    incomeData,
    balanceData,
    cashflowData,
    reportsLoading,
    loadData,
    loadEwaData,
    loadReports,
    loadShuData,
    loadSchedule,
    handleApplyEwa,
  };
}
