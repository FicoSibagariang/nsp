import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { MemberProfile } from '../types';

interface WithdrawSavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: MemberProfile | null;
  portalToken: string | null;
  initialBank?: string;
  initialAccount?: string;
  initialName?: string;
  onSuccess: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-md, 6px)',
  backgroundColor: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export const WithdrawSavingsModal: React.FC<WithdrawSavingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  portalToken,
  initialBank = '',
  initialAccount = '',
  initialName = '',
  onSuccess,
}) => {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState(initialBank);
  const [withdrawAccount, setWithdrawAccount] = useState(initialAccount);
  const [withdrawName, setWithdrawName] = useState(initialName);
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  if (!isOpen) return null;

  const handleApplyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalToken) return;
    setWithdrawLoading(true);
    setWithdrawError('');
    setWithdrawSuccess('');
    try {
      const numericAmount = parseFloat(withdrawAmount.replace(/\D/g, '')) || 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${portalToken}`,
      };
      const res = await fetch('/api/v1/portal/savings/withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: numericAmount,
          destinationBank: withdrawBank,
          destinationAccount: withdrawAccount,
          destinationName: withdrawName,
          notes: withdrawNotes || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setWithdrawSuccess(res.message || 'Pengajuan penarikan simpanan sukarela berhasil dikirim!');
        setWithdrawAmount('');
        setWithdrawNotes('');
        onSuccess();
        setTimeout(() => {
          onClose();
          setWithdrawSuccess('');
        }, 3000);
      } else {
        setWithdrawError(res.message || 'Gagal mengajukan penarikan');
      }
    } catch {
      setWithdrawError('Terjadi kesalahan jaringan');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
      <form onSubmit={handleApplyWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <VStack gap={1}>
          <Heading level={4}>Formulir Pengajuan Penarikan Simpanan Sukarela</Heading>
          <Text type="supporting" color="secondary">
            Simpanan sukarela dapat ditarik sewaktu-waktu sesuai saldo yang tersedia. Dana yang disetujui akan ditransfer langsung ke rekening bank tujuan Anda oleh bagian kasir/keuangan koperasi.
          </Text>
        </VStack>

        {withdrawError && (
          <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 600 }}>
            ⚠️ {withdrawError}
          </Text>
        )}

        {withdrawSuccess && (
          <Text type="supporting" style={{ color: 'var(--color-text-success)', fontWeight: 600 }}>
            ✅ {withdrawSuccess}
          </Text>
        )}

        {/* Saldo Sukarela Card & Quick Percentage Presets */}
        <Card style={{ padding: 12, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <VStack gap={0}>
              <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>
                Saldo Simpanan Sukarela Tersedia:
              </Text>
              <Heading level={3} color="primary">
                {formatRp(profile?.simpananSukarela || 0)}
              </Heading>
            </VStack>
            <HStack gap={1} wrap="wrap">
              {[
                { label: '25%', ratio: 0.25 },
                { label: '50%', ratio: 0.5 },
                { label: '75%', ratio: 0.75 },
                { label: 'Tarik Semua (100%)', ratio: 1.0 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const current = Number(profile?.simpananSukarela || 0);
                    const val = Math.floor(current * preset.ratio);
                    setWithdrawAmount(val > 0 ? val.toLocaleString('id-ID') : '');
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid var(--color-border-primary, #d1d5db)',
                    backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </HStack>
          </HStack>
        </Card>

        <Grid gap={4}>
          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nominal Penarikan (Rp):</Text>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 500.000"
              value={withdrawAmount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setWithdrawAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
              }}
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
              required
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nama Bank Tujuan:</Text>
            <input
              type="text"
              placeholder="Contoh: Bank Mandiri / BCA / BRI"
              value={withdrawBank}
              onChange={(e) => setWithdrawBank(e.target.value)}
              style={inputStyle}
              required
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nomor Rekening Tujuan:</Text>
            <input
              type="text"
              placeholder="Contoh: 1234567890"
              value={withdrawAccount}
              onChange={(e) => setWithdrawAccount(e.target.value)}
              style={inputStyle}
              required
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nama Pemilik Rekening:</Text>
            <input
              type="text"
              placeholder="Nama lengkap sesuai buku tabungan"
              value={withdrawName}
              onChange={(e) => setWithdrawName(e.target.value)}
              style={inputStyle}
              required
            />
          </VStack>
        </Grid>

        <VStack gap={2}>
          <Text type="supporting">Catatan / Keperluan (Opsional):</Text>
          <input
            type="text"
            placeholder="Contoh: Kebutuhan keluarga mendesak"
            value={withdrawNotes}
            onChange={(e) => setWithdrawNotes(e.target.value)}
            style={inputStyle}
          />
        </VStack>

        <HStack justify="end" gap={2}>
          <Button
            label="Batal"
            variant="ghost"
            onClick={onClose}
            isDisabled={withdrawLoading}
          />
          <Button
            label={withdrawLoading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Penarikan'}
            variant="primary"
            type="submit"
            isDisabled={withdrawLoading}
          />
        </HStack>
      </form>
    </Card>
  );
};
