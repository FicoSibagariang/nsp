import React, { useState, useEffect, useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import type { SavingsDepositRow } from '@shared/types';
import { useDemoMode } from '../contexts/DemoModeContextDef';
import { maskName } from '../utils/privacyMask';
import { getAuthenticatedFileUrl } from '../utils/fileUrl';

interface Props {
  deposit: SavingsDepositRow;
  onClose: () => void;
  onConfirm: (payload: { paymentTargetAccountId?: string }) => Promise<void> | void;
  isLoading?: boolean;
}

export function ApproveSavingsDepositDialogContent({
  deposit,
  onClose,
  onConfirm,
  isLoading = false,
}: Props) {
  const { isDemoMode } = useDemoMode();
  const displayName = isDemoMode
    ? maskName(deposit.memberId || deposit.memberName, deposit.memberName)
    : (deposit.memberName || 'Anggota Koperasi');

  const { data: paymentSourcesRes } = useApiQuery<{
    success: boolean;
    data: Array<{ id: string; code: string; name: string; type: string }>;
  }>('/api/savings/payment-sources');

  const paymentSources = useMemo(() => paymentSourcesRes?.data || [], [paymentSourcesRes?.data]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    if (!selectedAccountId && paymentSources.length > 0) {
      // Default to 11102 (Bank Mandiri)
      const mandiri = paymentSources.find((a) => a.code === '11102');
      if (mandiri) setSelectedAccountId(mandiri.id);
      else setSelectedAccountId(paymentSources[0].id);
    }
  }, [paymentSources, selectedAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      paymentTargetAccountId: selectedAccountId || undefined,
    });
  };

  const getSavingsTypeLabel = (type: string) => {
    switch (type) {
      case 'pokok':
        return 'Simpanan Pokok';
      case 'wajib':
        return 'Simpanan Wajib';
      case 'sukarela':
        return 'Simpanan Sukarela';
      default:
        return type;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack padding={4} gap={4}>
        <VStack gap={1}>
          <Heading level={3}>Verifikasi Setoran Simpanan</Heading>
          <Text type="supporting" color="secondary">
            Persetujuan akan memverifikasi setoran transfer anggota, menambah saldo simpanan anggota terkait, dan membukukan mutasi penerimaan kas/bank secara otomatis.
          </Text>
        </VStack>

        <VStack
          gap={2}
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-background-secondary)',
            borderRadius: 8,
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <HStack justify="between" vAlign="center">
            <Text type="supporting" color="secondary">Anggota:</Text>
            <Text type="body" weight="semibold">{displayName}</Text>
          </HStack>
          <HStack justify="between" vAlign="center">
            <Text type="supporting" color="secondary">Jenis Simpanan:</Text>
            <Text type="body" weight="semibold" color="primary">
              {getSavingsTypeLabel(deposit.savingsType)}
            </Text>
          </HStack>
          <HStack justify="between" vAlign="center">
            <Text type="supporting" color="secondary">Nominal Setoran:</Text>
            <Text type="body" weight="bold" color="primary">{formatRp(deposit.amount)}</Text>
          </HStack>
          <HStack justify="between" vAlign="center">
            <Text type="supporting" color="secondary">Tanggal Transfer:</Text>
            <Text type="body" weight="medium">{deposit.transferDate}</Text>
          </HStack>
          {(deposit.senderBank || deposit.senderAccount || deposit.senderName) && (
            <HStack justify="between" vAlign="center">
              <Text type="supporting" color="secondary">Rekening Pengirim:</Text>
              <Text type="body" weight="medium">
                {deposit.senderBank || '-'} {deposit.senderAccount ? `(${deposit.senderAccount})` : ''}{' '}
                {deposit.senderName ? `a.n. ${deposit.senderName}` : ''}
              </Text>
            </HStack>
          )}
          {deposit.proofUrl && (
            <HStack justify="between" vAlign="center">
              <Text type="supporting" color="secondary">Bukti Transfer:</Text>
              <a
                href={getAuthenticatedFileUrl(deposit.proofUrl)}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--color-primary-600)',
                  textDecoration: 'underline',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Lihat Bukti Transfer {deposit.proofName ? `(${deposit.proofName})` : '↗'}
              </a>
            </HStack>
          )}
          {deposit.notes && (
            <HStack justify="between" vAlign="start">
              <Text type="supporting" color="secondary">Catatan:</Text>
              <Text type="supporting" style={{ maxWidth: 300, textAlign: 'right' }}>{deposit.notes}</Text>
            </HStack>
          )}
        </VStack>

        <Selector
          label="Rekening Kas / Bank Penerima Setoran"
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          options={
            paymentSources.length > 0
              ? paymentSources.map((acc) => ({ value: acc.id, label: `${acc.name} (${acc.code})` }))
              : [
                  { value: 'ed0ad424-aff5-4a79-8fa2-24eaa541d6fc', label: 'Bank Mandiri (11102)' },
                  { value: '64fa79d2-cd8f-414a-80ac-7daae0e3fd1f', label: 'Kas Kecil (11101)' },
                ]
          }
          width="100%"
        />

        <HStack justify="end" gap={2} style={{ marginTop: 8 }}>
          <Button label="Batal" variant="ghost" onClick={onClose} isDisabled={isLoading} />
          <Button
            label={isLoading ? 'Memproses...' : 'Verifikasi & Bukukan'}
            variant="primary"
            type="submit"
            isDisabled={isLoading}
          />
        </HStack>
      </VStack>
    </form>
  );
}
