'use client';

import { useState, useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Button } from '@astryxdesign/core/Button';
import { useToast } from '@astryxdesign/core/Toast';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { apiFetch } from '../../../config';
import { formatRp } from '../../../utils/format';
import { CopyableAccountNumber } from '../../../components/CopyableAccountNumber';
import { Pagination } from '../../../components/Pagination';
import { DataStateView } from '../../../components/DataStateView';
import { useA11yDialog } from '../../../hooks/useA11yDialog';
import { ApproveSavingsWithdrawalDialogContent } from '../../../components/ApproveSavingsWithdrawalDialog';
import { RejectSavingsWithdrawalDialogContent } from '../../../components/RejectSavingsWithdrawalDialog';
import { useAuth } from '../../../hooks/useAuth';
import { useDemoMode } from '../../../contexts/DemoModeContextDef';
import { maskName, maskNik } from '../../../utils/privacyMask';
import type { SavingsWithdrawalRow, PaginatedResponse } from '@shared/types';

interface SavingsWithdrawalsTabProps {
  onMutationSuccess?: () => void;
}

export function SavingsWithdrawalsTab({ onMutationSuccess }: SavingsWithdrawalsTabProps) {
  const toast = useToast();
  const dialog = useA11yDialog({ purpose: 'form', width: 600 });
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();

  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<string>('Semua');
  const [withdrawalPage, setWithdrawalPage] = useState<number>(1);
  const [withdrawalLimit] = useState<number>(20);

  const withdrawalQueryUrl = useMemo(() => {
    const base = `/api/savings/withdrawals?page=${withdrawalPage}&limit=${withdrawalLimit}`;
    if (withdrawalStatusFilter !== 'Semua') {
      return `${base}&status=${encodeURIComponent(withdrawalStatusFilter)}`;
    }
    return base;
  }, [withdrawalPage, withdrawalLimit, withdrawalStatusFilter]);

  const {
    data: withdrawalsResponse,
    isLoading: withdrawalsLoading,
    error: withdrawalsError,
    refetch: fetchWithdrawals,
  } = useApiQuery<PaginatedResponse<SavingsWithdrawalRow>>(withdrawalQueryUrl);

  const withdrawalColumns: TableColumn<SavingsWithdrawalRow>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: 'Tanggal Pengajuan',
      width: proportional(1.8),
      renderCell: (item: SavingsWithdrawalRow) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">
            {new Date(item.createdAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
            {new Date(item.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })} WIB
          </Text>
        </VStack>
      ),
    },
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsWithdrawalRow) => {
        const displayName = isDemoMode
          ? maskName(item.memberId || item.memberName, item.memberName)
          : (item.memberName || 'Anggota');
        const displayNik = isDemoMode
          ? maskNik(item.memberId || item.memberName, item.memberNik)
          : item.memberNik;
        return (
          <VStack gap={0}>
            <Text type="body" weight="semibold">{displayName}</Text>
            {item.memberNik && (
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                NIK: {displayNik}
              </Text>
            )}
          </VStack>
        );
      },
    },
    {
      key: 'amount',
      header: 'Nominal Penarikan',
      width: proportional(1.6),
      renderCell: (item: SavingsWithdrawalRow) => (
        <Text type="body" weight="bold" style={{ color: 'var(--color-critical-500)' }}>
          {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'destinationBank',
      header: 'Rekening Tujuan',
      width: proportional(2.5),
      renderCell: (item: SavingsWithdrawalRow) => (
        <CopyableAccountNumber
          bankName={item.destinationBank}
          accountNumber={item.destinationAccount}
          accountHolder={item.destinationName}
        />
      ),
    },
    {
      key: 'notes',
      header: 'Catatan',
      width: proportional(2),
      renderCell: (item: SavingsWithdrawalRow) => (
        <Text type="supporting" color="secondary">
          {item.notes || '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: proportional(1.4),
      renderCell: (item: SavingsWithdrawalRow) => (
        <StatusBadge status={item.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Tindakan',
      width: proportional(2.5),
      renderCell: (item: SavingsWithdrawalRow) => {
        if (item.status === 'Menunggu') {
          if (hasPermission('update:savings')) {
            return (
              <HStack gap={2}>
                <Button
                  label="Setujui"
                  variant="primary"
                  onClick={() => {
                    dialog.show(
                      <ApproveSavingsWithdrawalDialogContent
                        withdrawal={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (payload) => {
                          try {
                            const res = await apiFetch(`/api/v1/savings/withdrawals/${item.id}/approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchWithdrawals();
                              onMutationSuccess?.();
                            } else {
                              toast({ type: 'error', body: res.message || 'Gagal menyetujui penarikan' });
                            }
                          } catch {
                            toast({ type: 'error', body: 'Terjadi kesalahan jaringan' });
                          }
                        }}
                      />
                    );
                  }}
                />
                <Button
                  label="Tolak"
                  variant="ghost"
                  onClick={() => {
                    dialog.show(
                      <RejectSavingsWithdrawalDialogContent
                        withdrawal={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (rejectionReason) => {
                          try {
                            const res = await apiFetch(`/api/v1/savings/withdrawals/${item.id}/reject`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rejectionReason }),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchWithdrawals();
                              onMutationSuccess?.();
                            } else {
                              toast({ type: 'error', body: res.message || 'Gagal menolak penarikan' });
                            }
                          } catch {
                            toast({ type: 'error', body: 'Terjadi kesalahan jaringan' });
                          }
                        }}
                      />
                    );
                  }}
                />
              </HStack>
            );
          }
          return <Text type="supporting" color="secondary">Menunggu persetujuan</Text>;
        }

        if (item.status === 'Disetujui') {
          return (
            <VStack gap={0}>
              <Text type="supporting" weight="medium" style={{ color: 'var(--color-success-600)' }}>
                ✓ Telah Dicairkan
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                {item.paymentSourceName ? `via ${item.paymentSourceName}` : ''}
              </Text>
            </VStack>
          );
        }

        return (
          <VStack gap={0}>
            <Text type="supporting" style={{ color: 'var(--color-text-error)' }} weight="medium">
              ✗ Ditolak
            </Text>
            {item.rejectionReason && (
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                Alasan: {item.rejectionReason}
              </Text>
            )}
          </VStack>
        );
      },
    },
  ], [isDemoMode, hasPermission, dialog, fetchWithdrawals, onMutationSuccess, toast]);

  return (
    <DataStateView
      isLoading={withdrawalsLoading}
      error={withdrawalsError}
      onRetry={fetchWithdrawals}
      errorTitle="Gagal Memuat Data Pengajuan Penarikan"
    >
      <VStack gap={4}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="supporting" weight="semibold" color="secondary">
            Filter Status:
          </Text>
          {['Semua', 'Menunggu', 'Disetujui', 'Ditolak'].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={withdrawalStatusFilter === st ? 'primary' : 'secondary'}
              onClick={() => {
                setWithdrawalStatusFilter(st);
                setWithdrawalPage(1);
              }}
              label={st}
            />
          ))}
        </HStack>

        <Table<SavingsWithdrawalRow>
          data={withdrawalsResponse?.data || []}
          columns={withdrawalColumns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
        />

        <Pagination
          page={withdrawalsResponse?.page || withdrawalPage}
          limit={withdrawalsResponse?.limit || withdrawalLimit}
          total={withdrawalsResponse?.total || 0}
          onPageChange={setWithdrawalPage}
        />
      </VStack>
    </DataStateView>
  );
}
