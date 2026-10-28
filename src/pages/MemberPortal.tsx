import { useState } from 'react';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Badge } from '@astryxdesign/core/Badge';
import { BanknotesIcon, ClipboardDocumentCheckIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { formatRp } from '../utils/format';
import {
  PortalLogin,
  PortalHeader,
  ApplyLoanModal,
  DepositConfirmModal,
  WithdrawSavingsModal,
  SavingsTab,
  LoansTab,
  EwaTab,
  ShuTab,
  ReportsTab,
  usePortalAuth,
  useMemberPortalData,
} from '../features/member-portal';

export default function MemberPortal() {
  const [activeTab, setActiveTab] = useState<'savings' | 'loans' | 'shu' | 'reports' | 'ewa'>('savings');
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);

  const auth = usePortalAuth();
  const data = useMemberPortalData(
    auth.memberToken,
    auth.clearPreviewSession,
    auth.setMemberToken,
    setActiveTab
  );

  if (!auth.memberToken) {
    return (
      <PortalLogin
        email={auth.email}
        setEmail={auth.setEmail}
        password={auth.password}
        setPassword={auth.setPassword}
        loading={auth.loading}
        error={auth.error}
        googleBtnRef={auth.googleBtnRef}
        hasGoogleClientId={auth.hasGoogleClientId}
        onSubmit={auth.handleLogin}
      />
    );
  }

  if (data.loading && !data.profile) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  const tabsConfig = [
    ...(data.profile?.isCoopMember !== false
      ? [
          { id: 'savings' as const, label: 'Simpanan', icon: BanknotesIcon },
          { id: 'loans' as const, label: 'Pinjaman', icon: ClipboardDocumentCheckIcon },
        ]
      : []),
    { id: 'ewa' as const, label: 'Gaji Awal (EWA)', icon: BanknotesIcon },
    ...(data.profile?.isCoopMember !== false && data.profile?.canViewShu !== false
      ? [{ id: 'shu' as const, label: 'SHU & Proyeksi', icon: SparklesIcon }]
      : []),
    ...(data.profile?.isCoopMember !== false
      ? [{ id: 'reports' as const, label: 'Laporan Keuangan', icon: ChartBarIcon }]
      : []),
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background-subtle)' }}>
      <Layout
        header={
          <PortalHeader
            profile={data.profile}
            isPreview={auth.isPreview}
            previewName={auth.previewName}
            onLogout={auth.handleLogout}
            onExitPreview={auth.exitPreview}
          />
        }
      >
        <LayoutContent padding={4}>
          <VStack gap={6} style={{ paddingBottom: '80px' }}>
            {data.error ? (
              <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>
                {data.error}
              </Text>
            ) : null}

            {data.profile?.isCoopMember === false && (
              <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-primary-500, #3b82f6)' }}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
                  <VStack gap={1}>
                    <HStack gap={2} vAlign="center">
                      <Badge variant="info" label="Karyawan Perusahaan Induk" />
                      <Badge variant="neutral" label="Non-Anggota Koperasi" />
                    </HStack>
                    <Heading level={3} style={{ margin: 0 }}>
                      Fasilitas Akses Gaji Awal (EWA)
                    </Heading>
                    <Text type="supporting" color="secondary">
                      Fasilitas kasbon penarikan gaji lebih awal untuk karyawan aktif • Plafon Maks. Sebulan: {formatRp(data.ewaQuota?.maxMonthlyLimit || 0)}
                    </Text>
                  </VStack>
                  <Card style={{ padding: '8px 16px', backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                    <VStack gap={0} hAlign="center">
                      <Text type="supporting">Sisa Kuota Siap Ditarik Hari Ini</Text>
                      <Heading level={3} color="primary">{formatRp(data.ewaQuota?.remainingQuota || 0)}</Heading>
                    </VStack>
                  </Card>
                </HStack>
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
                flexWrap: 'wrap',
              }}
            >
              {tabsConfig.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id === 'savings') data.setSelectedLoan(null);
                      if (tab.id === 'shu' && !data.shuData) data.loadShuData();
                      if (tab.id === 'reports' && (!data.incomeData || !data.balanceData)) data.loadReports();
                      if (tab.id === 'ewa' && !data.ewaQuota) data.loadEwaData();
                    }}
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
                      transition: 'all 0.15s ease',
                      backgroundColor: isActive
                        ? 'var(--color-background-primary)'
                        : 'transparent',
                      color: isActive
                        ? 'var(--color-primary-500, var(--color-text-primary))'
                        : 'var(--color-text-secondary)',
                      boxShadow: isActive
                        ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                        : 'none',
                    }}
                  >
                    <tab.icon style={{ width: 18, height: 18, color: 'currentColor' }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <Card>
              <VStack gap={4}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <Heading level={4}>
                    {activeTab === 'savings'
                      ? 'Riwayat Simpanan'
                      : activeTab === 'loans'
                      ? 'Daftar Pinjaman'
                      : activeTab === 'ewa'
                      ? 'Layanan Gaji Awal (EWA)'
                      : activeTab === 'shu'
                      ? 'Informasi SHU & Proyeksi Akhir Tahun'
                      : 'Ringkasan Laporan Keuangan Koperasi'}
                  </Heading>

                  {activeTab === 'shu' && data.shuData?.availableYears && data.shuData.availableYears.length > 1 && (
                    <HStack gap={2} vAlign="center">
                      <Text type="supporting" weight="medium">Tahun Buku:</Text>
                      <select
                        value={data.shuYear}
                        onChange={(e) => {
                          data.setShuYear(e.target.value);
                          data.loadShuData(e.target.value);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md, 6px)',
                          border: '1px solid var(--color-border-primary, #cbd5e1)',
                          backgroundColor: 'var(--color-background-primary, #ffffff)',
                          color: 'var(--color-text-primary, #1e293b)',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {data.shuData.availableYears.map((yr: string) => (
                          <option key={yr} value={yr}>
                            Tahun {yr} {yr === new Date().getFullYear().toString() ? '(Berjalan)' : ''}
                          </option>
                        ))}
                      </select>
                    </HStack>
                  )}

                  {activeTab === 'loans' && (
                    <Button
                      label={showApplyForm ? 'Tutup Formulir' : '+ Ajukan Pinjaman Baru'}
                      variant={showApplyForm ? 'ghost' : 'primary'}
                      onClick={() => setShowApplyForm(!showApplyForm)}
                    />
                  )}

                  {activeTab === 'savings' && (
                    <HStack gap={2} wrap="wrap">
                      <Button
                        label={showDepositForm ? 'Tutup Form Setoran' : '+ Konfirmasi Setoran Transfer'}
                        variant={showDepositForm ? 'ghost' : 'primary'}
                        onClick={() => {
                          setShowDepositForm(!showDepositForm);
                          setShowWithdrawForm(false);
                        }}
                      />
                      <Button
                        label={showWithdrawForm ? 'Tutup Form Penarikan' : 'Tarik Simpanan Sukarela'}
                        variant={showWithdrawForm ? 'ghost' : 'secondary'}
                        onClick={() => {
                          setShowWithdrawForm(!showWithdrawForm);
                          setShowDepositForm(false);
                        }}
                        isDisabled={(data.profile?.simpananSukarela || 0) <= 0}
                      />
                    </HStack>
                  )}
                </HStack>

                {/* Modals & Forms */}
                <ApplyLoanModal
                  isOpen={activeTab === 'loans' && showApplyForm}
                  onClose={() => setShowApplyForm(false)}
                  profile={data.profile}
                  portalToken={auth.memberToken}
                  onSuccess={data.loadData}
                />

                <DepositConfirmModal
                  isOpen={activeTab === 'savings' && showDepositForm}
                  onClose={() => setShowDepositForm(false)}
                  profile={data.profile}
                  portalToken={auth.memberToken}
                  initialSenderName={data.profile?.employee?.bankAccountName || data.profile?.name || ''}
                  onSuccess={data.loadData}
                />

                <WithdrawSavingsModal
                  isOpen={activeTab === 'savings' && showWithdrawForm}
                  onClose={() => setShowWithdrawForm(false)}
                  profile={data.profile}
                  portalToken={auth.memberToken}
                  initialBank={data.profile?.employee?.bankName || ''}
                  initialAccount={data.profile?.employee?.bankAccountNumber || ''}
                  initialName={data.profile?.employee?.bankAccountName || data.profile?.name || ''}
                  onSuccess={data.loadData}
                />

                {/* Tab Views */}
                {activeTab === 'savings' && (
                  <SavingsTab
                    profile={data.profile}
                    transactions={data.transactions}
                    savingsWithdrawals={data.savingsWithdrawals}
                    savingsDeposits={data.savingsDeposits}
                    onOpenWithdrawForm={() => {
                      setActiveTab('savings');
                      setShowWithdrawForm(true);
                      setShowDepositForm(false);
                    }}
                  />
                )}

                {activeTab === 'loans' && (
                  <LoansTab
                    loans={data.loans}
                    selectedLoan={data.selectedLoan}
                    setSelectedLoan={data.setSelectedLoan}
                    schedule={data.schedule}
                    scheduleLoading={data.scheduleLoading}
                    payments={data.payments}
                    paymentsLoading={data.paymentsLoading}
                    loadSchedule={data.loadSchedule}
                    setSchedule={data.setSchedule}
                  />
                )}

                {activeTab === 'ewa' && (
                  <EwaTab
                    profile={data.profile}
                    ewaQuota={data.ewaQuota}
                    ewaHistory={data.ewaHistory}
                    feeTiers={data.feeTiers}
                    ewaLoading={data.ewaLoading}
                    ewaAmount={data.ewaAmount}
                    setEwaAmount={data.setEwaAmount}
                    ewaSubmitLoading={data.ewaSubmitLoading}
                    ewaError={data.ewaError}
                    ewaSuccess={data.ewaSuccess}
                    onApplyEwa={data.handleApplyEwa}
                  />
                )}

                {activeTab === 'shu' && (
                  <ShuTab
                    shuData={data.shuData}
                    shuLoading={data.shuLoading}
                    shuError={data.shuError}
                    profile={data.profile}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsTab
                    incomeData={data.incomeData}
                    balanceData={data.balanceData}
                    cashflowData={data.cashflowData}
                    reportsLoading={data.reportsLoading}
                  />
                )}
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      </Layout>
    </div>
  );
}
