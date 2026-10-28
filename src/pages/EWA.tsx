import { useState, useEffect, useCallback } from 'react';
import { Layout, LayoutContent, LayoutHeader, StackItem } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Badge } from '@astryxdesign/core/Badge';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../config';
import {
  BanknotesIcon,
  UserGroupIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  TagIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { Icon } from '@astryxdesign/core/Icon';
import type { CompanyEmployee, EWARequest, EwaFeeTier } from '@shared/types';
import { useDemoMode } from '../contexts/DemoModeContext';
import { formatRp } from '../utils/format';
import { maskName, maskNip } from '../utils/privacyMask';
import {
  DisburseModal,
  RejectModal,
  FeeTierModal,
  ImportEmployeesModal,
  RequestsTab,
  EmployeesTab,
  PayrollTab,
  FeeTiersTab,
  exportPayrollXlsx,
  type PaymentSourceAccount,
  type PayrollRecapData,
} from '../features/ewa';

export default function EWA() {
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();
  const canViewEmployees = hasPermission('approve:loans');
  const canImportEmployees = hasPermission('create:members');
  const [activeTab, setActiveTab] = useState<'requests' | 'employees' | 'payroll' | 'fee-tiers'>('requests');

  useEffect(() => {
    if (!canViewEmployees && activeTab === 'employees') {
      setActiveTab('requests');
    }
  }, [canViewEmployees, activeTab]);

  // Requests State
  const [requests, setRequests] = useState<EWARequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [reqSearch, setReqSearch] = useState('');
  const [debouncedReqSearch, setDebouncedReqSearch] = useState('');
  const [reqPage, setReqPage] = useState(1);
  const reqLimit = 20;
  const [reqTotal, setReqTotal] = useState(0);
  const [selectedReq, setSelectedReq] = useState<EWARequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Payment Sources & Disburse Modal
  const [paymentSources, setPaymentSources] = useState<PaymentSourceAccount[]>([]);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [selectedDisburseReq, setSelectedDisburseReq] = useState<EWARequest | null>(null);

  // Employees State
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empPage, setEmpPage] = useState(1);
  const empLimit = 20;
  const [empTotal, setEmpTotal] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);

  // Payroll Recap State
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollRecap, setPayrollRecap] = useState<PayrollRecapData | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Fee Tiers State
  const [feeTiers, setFeeTiers] = useState<EwaFeeTier[]>([]);
  const [feeTiersLoading, setFeeTiersLoading] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<EwaFeeTier | null>(null);

  // Debounce search for requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedReqSearch(reqSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [reqSearch]);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.append('status', statusFilter);
      if (debouncedReqSearch.trim()) q.append('search', debouncedReqSearch.trim());
      q.append('page', String(reqPage));
      q.append('limit', String(reqLimit));
      const res = await apiFetch(`/api/v1/ewa/requests?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
        setReqTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setReqLoading(false);
    }
  }, [statusFilter, debouncedReqSearch, reqPage, reqLimit]);

  // Fetch Employees
  const fetchEmployees = useCallback(async () => {
    if (!canViewEmployees) return;
    setEmpLoading(true);
    try {
      const q = new URLSearchParams();
      if (empSearch.trim()) q.append('search', empSearch.trim());
      q.append('page', String(empPage));
      q.append('limit', String(empLimit));
      const res = await apiFetch(`/api/v1/ewa/employees?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data || []);
        setEmpTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
    } finally {
      setEmpLoading(false);
    }
  }, [canViewEmployees, empSearch, empPage, empLimit]);

  // Fetch Payroll Recap
  const fetchPayrollRecap = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const res = await apiFetch(`/api/v1/ewa/payroll/recap?periodMonth=${encodeURIComponent(payrollMonth)}`);
      const data = await res.json();
      if (data.success) {
        setPayrollRecap(data.data);
      }
    } catch (err) {
      console.error('Fetch payroll recap error:', err);
    } finally {
      setPayrollLoading(false);
    }
  }, [payrollMonth]);

  // Fetch Fee Tiers
  const fetchFeeTiers = useCallback(async () => {
    setFeeTiersLoading(true);
    try {
      const res = await apiFetch('/api/v1/ewa/fee-tiers');
      const data = await res.json();
      if (data.success) {
        setFeeTiers(data.data || []);
      }
    } catch (err) {
      console.error('Fetch fee tiers error:', err);
    } finally {
      setFeeTiersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (canViewEmployees) {
      fetchEmployees();
    }
  }, [canViewEmployees, fetchEmployees]);

  useEffect(() => {
    if (activeTab === 'payroll') fetchPayrollRecap();
  }, [activeTab, fetchPayrollRecap]);

  useEffect(() => {
    if (activeTab === 'fee-tiers') fetchFeeTiers();
  }, [activeTab, fetchFeeTiers]);

  // Fetch Payment Sources
  const fetchPaymentSources = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/ewa/payment-sources');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPaymentSources(data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil sumber dana EWA:', err);
    }
  }, []);

  useEffect(() => {
    fetchPaymentSources();
  }, [fetchPaymentSources]);

  const tabsConfig = [
    { id: 'requests' as const, label: 'Pengajuan & Pencairan', count: reqTotal || requests.length, icon: BanknotesIcon },
    ...(canViewEmployees
      ? [{ id: 'employees' as const, label: 'Master Karyawan & Gaji', count: empTotal || employees.length, icon: UserGroupIcon }]
      : []),
    { id: 'payroll' as const, label: 'Rekap Potongan Payroll (HRD)', count: payrollRecap?.totalEmployees || 0, icon: DocumentArrowDownIcon },
    { id: 'fee-tiers' as const, label: 'Tarif Biaya Admin', count: feeTiers.length, icon: TagIcon },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider padding={4}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <StackItem size="fill">
              <VStack gap={1}>
                <Heading level={1} style={{ margin: 0 }}>
                  Layanan Gaji Awal (EWA)
                </Heading>
                <Text type="supporting" color="secondary">
                  Earned Wage Access — Fasilitas kasbon gaji karyawan perusahaan induk
                </Text>
              </VStack>
            </StackItem>

            <HStack gap={2} vAlign="center">
              <IconButton
                label="Muat Ulang"
                variant="ghost"
                icon={<Icon icon={ArrowPathIcon} size="sm" />}
                onClick={() => {
                  if (activeTab === 'requests') fetchRequests();
                  if (activeTab === 'employees' && canViewEmployees) fetchEmployees();
                  if (activeTab === 'payroll') fetchPayrollRecap();
                  if (activeTab === 'fee-tiers') fetchFeeTiers();
                }}
              />
              {activeTab === 'employees' && canViewEmployees && canImportEmployees && (
                <Button
                  label="Import Data Karyawan (CSV)"
                  variant="primary"
                  icon={<Icon icon={ArrowUpTrayIcon} size="sm" />}
                  onClick={() => setShowImportModal(true)}
                />
              )}
              {activeTab === 'payroll' && payrollRecap?.items && payrollRecap.items.length > 0 && (
                <Button
                  label="Ekspor XLSX untuk HRD"
                  variant="primary"
                  icon={<Icon icon={DocumentArrowDownIcon} size="sm" />}
                  onClick={() => exportPayrollXlsx(payrollRecap, payrollMonth, isDemoMode)}
                />
              )}
              {activeTab === 'fee-tiers' && (
                <Button
                  label="Tambah Rentang Tarif"
                  variant="primary"
                  icon={<Icon icon={PlusIcon} size="sm" />}
                  onClick={() => {
                    setEditingTier(null);
                    setShowTierModal(true);
                  }}
                />
              )}
            </HStack>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        <VStack gap={6} style={{ paddingBottom: '80px' }}>
          {actionMessage && (
            <Card
              style={{
                padding: 12,
                backgroundColor:
                  actionMessage.type === 'success'
                    ? 'var(--color-background-success-subtle, rgba(34, 197, 94, 0.1))'
                    : 'var(--color-background-critical-subtle, rgba(239, 68, 68, 0.1))',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--color-success-500, #22c55e)' : 'var(--color-critical-500, #ef4444)'}`,
              }}
            >
              <Text type="body" weight="semibold">
                {actionMessage.type === 'success' ? '✅ ' : '⚠️ '}
                {actionMessage.text}
              </Text>
            </Card>
          )}

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              backgroundColor: 'var(--color-background-secondary)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border-primary)',
              gap: 4,
              width: 'fit-content',
            }}
          >
            {tabsConfig.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--color-background-primary)' : 'transparent',
                    color: isActive ? 'var(--color-primary-500, var(--color-text-primary))' : 'var(--color-text-secondary)',
                    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  <tab.icon style={{ width: 18, height: 18, color: 'currentColor' }} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <Badge variant={isActive ? 'success' : 'neutral'} label={String(tab.count)} />
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: REQUESTS */}
          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              reqLoading={reqLoading}
              reqSearch={reqSearch}
              setReqSearch={setReqSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              reqPage={reqPage}
              reqLimit={reqLimit}
              reqTotal={reqTotal}
              setReqPage={setReqPage}
              isDemoMode={isDemoMode}
              actionLoading={false}
              onDisburse={(req) => {
                setSelectedDisburseReq(req);
                setShowDisburseModal(true);
              }}
              onReject={(req) => {
                setSelectedReq(req);
                setShowRejectModal(true);
              }}
            />
          )}

          {/* TAB 2: EMPLOYEES */}
          {activeTab === 'employees' && canViewEmployees && (
            <EmployeesTab
              empTotal={empTotal}
              empSearch={empSearch}
              setEmpSearch={setEmpSearch}
              empLoading={empLoading}
              employees={employees}
              empPage={empPage}
              empLimit={empLimit}
              setEmpPage={setEmpPage}
              isDemoMode={isDemoMode}
            />
          )}

          {/* TAB 3: PAYROLL RECAP */}
          {activeTab === 'payroll' && (
            <PayrollTab
              payrollMonth={payrollMonth}
              handlePayrollMonthChange={setPayrollMonth}
              payrollRecap={payrollRecap}
              payrollLoading={payrollLoading}
              formatRp={formatRp}
              isDemoMode={isDemoMode}
              maskNip={maskNip}
              maskName={maskName}
              onPayrollSettled={(msg) => {
                setActionMessage({ text: msg, type: 'success' });
                fetchPayrollRecap();
              }}
              onError={(msg) => {
                setActionMessage({ text: msg, type: 'error' });
              }}
            />
          )}

          {/* TAB 4: FEE TIERS */}
          {activeTab === 'fee-tiers' && (
            <FeeTiersTab
              openAddTier={() => {
                setEditingTier(null);
                setShowTierModal(true);
              }}
              feeTiersLoading={feeTiersLoading}
              feeTiers={feeTiers}
              onEditTier={(tier) => {
                setEditingTier(tier);
                setShowTierModal(true);
              }}
              onTiersUpdated={(updatedList, msg) => {
                setFeeTiers(updatedList);
                setActionMessage({ text: msg, type: 'success' });
                setTimeout(() => setActionMessage(null), 5000);
              }}
            />
          )}

          {/* Modals */}
          <DisburseModal
            isOpen={showDisburseModal}
            onClose={() => {
              setShowDisburseModal(false);
              setSelectedDisburseReq(null);
            }}
            request={selectedDisburseReq}
            paymentSources={paymentSources}
            isDemoMode={isDemoMode}
            onSuccess={(msg) => {
              setActionMessage({ text: msg, type: 'success' });
              fetchRequests();
            }}
            onError={(msg) => {
              setActionMessage({ text: msg, type: 'error' });
            }}
          />

          <RejectModal
            isOpen={showRejectModal}
            onClose={() => {
              setShowRejectModal(false);
              setSelectedReq(null);
            }}
            request={selectedReq}
            isDemoMode={isDemoMode}
            onSuccess={(msg) => {
              setActionMessage({ text: msg, type: 'success' });
              fetchRequests();
            }}
            onError={(msg) => {
              setActionMessage({ text: msg, type: 'error' });
            }}
          />

          <FeeTierModal
            isOpen={showTierModal}
            onClose={() => setShowTierModal(false)}
            editingTier={editingTier}
            feeTiers={feeTiers}
            onSuccess={(updatedList) => {
              setFeeTiers(updatedList);
              setActionMessage({ text: 'Tabel tarif biaya admin berhasil diperbarui!', type: 'success' });
              setTimeout(() => setActionMessage(null), 5000);
            }}
          />

          <ImportEmployeesModal
            isOpen={showImportModal && canImportEmployees}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setActiveTab('employees');
              fetchEmployees();
            }}
          />
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
