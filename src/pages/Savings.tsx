'use client';

import { useState } from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { useApiQuery } from '../hooks/useApiQuery';
import { useA11yDialog } from '../hooks/useA11yDialog';
import { useAuth } from '../hooks/useAuth';
import { SavingsPayrollWajibDialogContent } from '../components/SavingsPayrollWajibDialog';
import {
  SavingsMutationsTab,
  SavingsDepositsTab,
  SavingsWithdrawalsTab,
} from '../features/savings';
import type { SavingsWithdrawalRow, SavingsDepositRow, PaginatedResponse } from '@shared/types';

export default function SavingsTemplate() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'deposits' | 'withdrawals'>('transactions');
  const [mutationsKey, setMutationsKey] = useState(0);
  const dialog = useA11yDialog({ purpose: 'form', width: 850 });
  const { hasPermission } = useAuth();

  // Pending counts for badges
  const {
    data: pendingDepositsCountResponse,
    refetch: fetchPendingDepositsCount,
  } = useApiQuery<PaginatedResponse<SavingsDepositRow>>('/api/savings/deposits?status=Menunggu&limit=1');
  const pendingDepositsCount = pendingDepositsCountResponse?.total ?? 0;

  const {
    data: pendingCountResponse,
    refetch: fetchPendingCount,
  } = useApiQuery<PaginatedResponse<SavingsWithdrawalRow>>('/api/savings/withdrawals?status=Menunggu&limit=1');
  const pendingCount = pendingCountResponse?.total ?? 0;

  const handleRefreshBadges = () => {
    fetchPendingDepositsCount();
    fetchPendingCount();
  };

  return (
    <>
      <Layout
        height="auto"
        header={
          <LayoutHeader hasDivider padding={4}>
            <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
              <StackItem>
                <VStack gap={0}>
                  <Heading level={1}>Pengelolaan Simpanan Anggota</Heading>
                  <Text type="supporting" color="secondary">
                    Kelola mutasi simpanan pokok, wajib, sukarela, serta verifikasi setoran dan pengajuan penarikan
                  </Text>
                </VStack>
              </StackItem>
              {hasPermission('update:savings') && (
                <StackItem>
                  <Button
                    variant="primary"
                    label="Rekap & Bukukan Simpanan Wajib Payroll"
                    onClick={() => {
                      dialog.show(
                        <SavingsPayrollWajibDialogContent
                          onClose={() => dialog.hide()}
                          onSuccess={() => setMutationsKey((k) => k + 1)}
                        />
                      );
                    }}
                  />
                </StackItem>
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={4}>
            <VStack gap={4}>
              {/* Tab Navigation */}
              <HStack gap={2} style={{ borderBottom: '1px solid var(--color-border-primary)', paddingBottom: 8 }}>
                <Button
                  variant={activeTab === 'transactions' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('transactions')}
                  label="Buku Mutasi Simpanan"
                />
                <Button
                  variant={activeTab === 'deposits' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('deposits')}
                  label="Konfirmasi Setoran Masuk"
                  endContent={
                    pendingDepositsCount > 0 ? (
                      <Badge variant="warning" label={String(pendingDepositsCount)} />
                    ) : undefined
                  }
                />
                <Button
                  variant={activeTab === 'withdrawals' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('withdrawals')}
                  label="Permohonan Penarikan Sukarela"
                  endContent={
                    pendingCount > 0 ? (
                      <Badge variant="warning" label={String(pendingCount)} />
                    ) : undefined
                  }
                />
              </HStack>

              {/* Tab Contents */}
              {activeTab === 'transactions' && <SavingsMutationsTab key={mutationsKey} />}
              {activeTab === 'deposits' && (
                <SavingsDepositsTab onMutationSuccess={handleRefreshBadges} />
              )}
              {activeTab === 'withdrawals' && (
                <SavingsWithdrawalsTab onMutationSuccess={handleRefreshBadges} />
              )}
            </VStack>
          </LayoutContent>
        }
      />
      {dialog.element}
    </>
  );
}
