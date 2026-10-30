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
import { useApiQuery } from '../hooks/useApiQuery';
import {
  SavingsMutationsTab,
  SavingsDepositsTab,
  SavingsWithdrawalsTab,
} from '../features/savings';
import type { SavingsWithdrawalRow, SavingsDepositRow, PaginatedResponse } from '@shared/types';

export default function SavingsTemplate() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'deposits' | 'withdrawals'>('transactions');

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
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Tab Navigation */}
            <HStack gap={2} style={{ borderBottom: '1px solid var(--color-border-primary)', paddingBottom: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: activeTab === 'transactions' ? 600 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeTab === 'transactions' ? 'var(--color-primary-600, #2563eb)' : 'transparent',
                  color: activeTab === 'transactions' ? '#ffffff' : 'var(--color-text-secondary, #6b7280)',
                }}
              >
                Buku Mutasi Simpanan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deposits')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: activeTab === 'deposits' ? 600 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeTab === 'deposits' ? 'var(--color-primary-600, #2563eb)' : 'transparent',
                  color: activeTab === 'deposits' ? '#ffffff' : 'var(--color-text-secondary, #6b7280)',
                }}
              >
                <span>Konfirmasi Setoran Masuk</span>
                {pendingDepositsCount > 0 && (
                  <Badge variant="warning" label={String(pendingDepositsCount)} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('withdrawals')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: activeTab === 'withdrawals' ? 600 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeTab === 'withdrawals' ? 'var(--color-primary-600, #2563eb)' : 'transparent',
                  color: activeTab === 'withdrawals' ? '#ffffff' : 'var(--color-text-secondary, #6b7280)',
                }}
              >
                <span>Permohonan Penarikan Sukarela</span>
                {pendingCount > 0 && (
                  <Badge variant="warning" label={String(pendingCount)} />
                )}
              </button>
            </HStack>

            {/* Tab Contents */}
            {activeTab === 'transactions' && <SavingsMutationsTab />}
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
  );
}
