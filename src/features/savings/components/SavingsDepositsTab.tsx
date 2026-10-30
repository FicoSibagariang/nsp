'use client';

import { useState, useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Button } from '@astryxdesign/core/Button';
import { useToast } from '@astryxdesign/core/Toast';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { apiFetch } from '../../../config';
import { formatRp } from '../../../utils/format';
import { getAuthenticatedFileUrl } from '../../../utils/fileUrl';
import { Pagination } from '../../../components/Pagination';
import { DataStateView } from '../../../components/DataStateView';
import { useA11yDialog } from '../../../hooks/useA11yDialog';
import { ApproveSavingsDepositDialogContent } from '../../../components/ApproveSavingsDepositDialog';
import { RejectSavingsDepositDialogContent } from '../../../components/RejectSavingsDepositDialog';
import { useAuth } from '../../../hooks/useAuth';
import { useDemoMode } from '../../../contexts/DemoModeContextDef';
import { maskName, maskNik } from '../../../utils/privacyMask';
import type { SavingsDepositRow, PaginatedResponse } from '@shared/types';

interface SavingsDepositsTabProps {
  onMutationSuccess?: () => void;
  pendingCount?: number;
}

export function SavingsDepositsTab({ onMutationSuccess, pendingCount = 0 }: SavingsDepositsTabProps) {
  const toast = useToast();
  const dialog = useA11yDialog({ purpose: 'form', width: 600 });
  const { hasPermission } = useAuth();
  const { isDemoMode } = useDemoMode();

  const [depositStatusFilter, setDepositStatusFilter] = useState<string>('Semua');
  const [depositTypeFilter, setDepositTypeFilter] = useState<string>('Semua');
  const [depositPage, setDepositPage] = useState<number>(1);
  const [depositLimit] = useState<number>(20);

  const depositQueryUrl = useMemo(() => {
    let url = `/api/savings/deposits?page=${depositPage}&limit=${depositLimit}`;
    if (depositStatusFilter !== 'Semua') {
      url += `&status=${encodeURIComponent(depositStatusFilter)}`;
    }
    if (depositTypeFilter !== 'Semua') {
      url += `&savingsType=${encodeURIComponent(depositTypeFilter)}`;
    }
    return url;
  }, [depositPage, depositLimit, depositStatusFilter, depositTypeFilter]);

  const {
    data: depositsResponse,
    isLoading: depositsLoading,
    error: depositsError,
    refetch: fetchDeposits,
  } = useApiQuery<PaginatedResponse<SavingsDepositRow>>(depositQueryUrl);

  const depositColumns: TableColumn<SavingsDepositRow>[] = useMemo(() => [
    {
      key: 'transferDate',
      header: 'Tgl Transfer',
      width: pixel(120),
      renderCell: (item: SavingsDepositRow) => (
        <Text type="body">{item.transferDate || '-'}</Text>
      ),
    },
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsDepositRow) => {
        const displayName = isDemoMode
          ? maskName(item.memberId || item.memberName, item.memberName)
          : (item.memberName || 'Anggota Koperasi');
        const displayNik = isDemoMode
          ? maskNik(item.memberId || item.memberName, item.memberNik)
          : item.memberNik;
        return (
          <VStack gap={0}>
            <Text type="body" weight="medium">{displayName}</Text>
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
      key: 'savingsType',
      header: 'Jenis Simpanan',
      width: pixel(150),
      renderCell: (item: SavingsDepositRow) => (
        <StatusBadge status={item.savingsType} />
      ),
    },
    {
      key: 'amount',
      header: 'Nominal Setoran',
      width: pixel(160),
      renderCell: (item: SavingsDepositRow) => (
        <Text type="body" weight="bold" color="primary">
          {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'senderInfo',
      header: 'Rekening Pengirim',
      width: proportional(2),
      renderCell: (item: SavingsDepositRow) => (
        <VStack gap={0}>
          <Text type="body">
            {item.senderBank || '-'} {item.senderAccount ? `(${item.senderAccount})` : ''}
          </Text>
          {item.senderName && (
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              a.n. {item.senderName}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'proofUrl',
      header: 'Bukti Transfer',
      width: pixel(130),
      renderCell: (item: SavingsDepositRow) => {
        if (!item.proofUrl) {
          return <Text type="supporting" color="secondary">Tanpa bukti</Text>;
        }
        return (
          <a
            href={getAuthenticatedFileUrl(item.proofUrl)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--color-primary-600)',
              textDecoration: 'underline',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Lihat Bukti ↗
          </a>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (item: SavingsDepositRow) => (
        <StatusBadge status={item.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Aksi / Keterangan',
      width: proportional(2.5),
      renderCell: (item: SavingsDepositRow) => {
        if (item.status === 'Menunggu') {
          if (hasPermission('update:savings')) {
            return (
              <HStack gap={2}>
                <Button
                  label="Verifikasi"
                  variant="primary"
                  onClick={() => {
                    dialog.show(
                      <ApproveSavingsDepositDialogContent
                        deposit={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (payload) => {
                          try {
                            const res = await apiFetch(`/api/v1/savings/deposits/${item.id}/approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchDeposits();
                              onMutationSuccess?.();
                            } else {
                              toast({ body: res.message || 'Gagal memverifikasi setoran', type: 'error' });
                            }
                          } catch {
                            toast({ body: 'Terjadi kesalahan jaringan', type: 'error' });
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
                      <RejectSavingsDepositDialogContent
                        deposit={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (reason) => {
                          try {
                            const res = await apiFetch(`/api/v1/savings/deposits/${item.id}/reject`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rejectionReason: reason }),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchDeposits();
                              onMutationSuccess?.();
                            } else {
                              toast({ body: res.message || 'Gagal menolak setoran', type: 'error' });
                            }
                          } catch {
                            toast({ body: 'Terjadi kesalahan jaringan', type: 'error' });
                          }
                        }}
                      />
                    );
                  }}
                />
              </HStack>
            );
          }
          return <Text type="supporting" color="secondary">Menunggu verifikasi</Text>;
        }

        if (item.status === 'Diverifikasi') {
          return (
            <VStack gap={0}>
              <Text type="supporting" weight="medium" style={{ color: 'var(--color-success-600)' }}>
                ✓ Diverifikasi
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                {item.paymentTargetName ? `Rek: ${item.paymentTargetName}` : ''}
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
  ], [isDemoMode, hasPermission, dialog, fetchDeposits, onMutationSuccess, toast]);

  return (
    <DataStateView
      isLoading={depositsLoading}
      error={depositsError}
      onRetry={fetchDeposits}
      errorTitle="Gagal Memuat Data Konfirmasi Setoran"
    >
      <VStack gap={4}>
        {/* Status & Type Filter Pills */}
        <HStack gap={4} wrap="wrap" vAlign="center" justify="between">
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting" weight="semibold" color="secondary">
              Status:
            </Text>
            {['Semua', 'Menunggu', 'Diverifikasi', 'Ditolak'].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={depositStatusFilter === st ? 'primary' : 'secondary'}
                onClick={() => {
                  setDepositStatusFilter(st);
                  setDepositPage(1);
                }}
                label={`${st}${st === 'Menunggu' && pendingCount > 0 ? ` (${pendingCount})` : ''}`}
              />
            ))}
          </HStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting" weight="semibold" color="secondary">
              Jenis:
            </Text>
            {[
              { val: 'Semua', label: 'Semua Jenis' },
              { val: 'pokok', label: 'Pokok' },
              { val: 'wajib', label: 'Wajib' },
              { val: 'sukarela', label: 'Sukarela' },
            ].map((t) => (
              <Button
                key={t.val}
                size="sm"
                variant={depositTypeFilter === t.val ? 'primary' : 'secondary'}
                onClick={() => {
                  setDepositTypeFilter(t.val);
                  setDepositPage(1);
                }}
                label={t.label}
              />
            ))}
          </HStack>
        </HStack>

        <Table<SavingsDepositRow>
          data={depositsResponse?.data || []}
          columns={depositColumns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
        />

        <Pagination
          page={depositsResponse?.page || depositPage}
          limit={depositsResponse?.limit || depositLimit}
          total={depositsResponse?.total || 0}
          onPageChange={setDepositPage}
        />
      </VStack>
    </DataStateView>
  );
}
