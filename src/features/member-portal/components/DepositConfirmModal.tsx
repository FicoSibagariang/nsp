import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { MemberProfile } from '../types';

interface DepositConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: MemberProfile | null;
  portalToken: string | null;
  initialSenderName?: string;
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

export const DepositConfirmModal: React.FC<DepositConfirmModalProps> = ({
  isOpen,
  onClose,
  profile,
  portalToken,
  initialSenderName = '',
  onSuccess,
}) => {
  const [depositSavingsType, setDepositSavingsType] = useState<'pokok' | 'wajib' | 'sukarela'>('wajib');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTransferDate, setDepositTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depositSenderBank, setDepositSenderBank] = useState('');
  const [depositSenderAccount, setDepositSenderAccount] = useState('');
  const [depositSenderName, setDepositSenderName] = useState(initialSenderName);
  const [depositNotes, setDepositNotes] = useState('');
  const [depositProofUrl, setDepositProofUrl] = useState('');
  const [depositProofName, setDepositProofName] = useState('');
  const [depositUploadingProof, setDepositUploadingProof] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositSuccess, setDepositSuccess] = useState('');

  if (!isOpen) return null;

  const handleUploadDepositProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setDepositError('Ukuran file bukti transfer maksimal 5MB');
      return;
    }

    try {
      setDepositUploadingProof(true);
      setDepositError('');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/upload/savings-proof', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${portalToken}`,
        },
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data) {
        setDepositProofUrl(res.data.url);
        setDepositProofName(res.data.filename || file.name);
      } else {
        setDepositError(res.message || 'Gagal mengunggah bukti transfer');
      }
    } catch {
      setDepositError('Terjadi kesalahan jaringan saat mengunggah bukti');
    } finally {
      setDepositUploadingProof(false);
    }
  };

  const handleApplyDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalToken) return;

    setDepositLoading(true);
    setDepositError('');
    setDepositSuccess('');

    try {
      const numericAmount = parseFloat(depositAmount.replace(/\D/g, '')) || 0;
      if (numericAmount <= 0) {
        setDepositError('Nominal setoran harus lebih besar dari Rp 0');
        setDepositLoading(false);
        return;
      }

      const res = await fetch('/api/v1/portal/savings/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${portalToken}`,
        },
        body: JSON.stringify({
          savingsType: depositSavingsType,
          amount: numericAmount,
          transferDate: depositTransferDate,
          senderBank: depositSenderBank.trim() || undefined,
          senderAccount: depositSenderAccount.trim() || undefined,
          senderName: depositSenderName.trim() || undefined,
          proofUrl: depositProofUrl || undefined,
          proofName: depositProofName || undefined,
          notes: depositNotes.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setDepositSuccess(res.message || 'Konfirmasi setoran simpanan berhasil dikirim!');
        setDepositAmount('');
        setDepositNotes('');
        setDepositProofUrl('');
        setDepositProofName('');
        const fileInput = document.getElementById('deposit-proof-file') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';

        onSuccess();
        setTimeout(() => {
          onClose();
          setDepositSuccess('');
        }, 3500);
      } else {
        setDepositError(res.message || 'Gagal mengirim konfirmasi setoran');
      }
    } catch {
      setDepositError('Terjadi kesalahan jaringan saat mengirim konfirmasi setoran');
    } finally {
      setDepositLoading(false);
    }
  };

  return (
    <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
      <form onSubmit={handleApplyDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <VStack gap={1}>
          <Heading level={4}>Konfirmasi Setoran Simpanan (Transfer Bank)</Heading>
          <Text type="supporting" color="secondary">
            Gunakan formulir ini untuk mengonfirmasi setoran yang telah Anda transfer ke rekening {profile?.coopBank?.bankName || 'Bank Mandiri'} resmi koperasi ({profile?.coopBank?.accountNumber || '1060022716008'}). Setoran akan diverifikasi oleh bendahara dan otomatis dibukukan ke saldo simpanan Anda.
          </Text>
        </VStack>

        {depositError && (
          <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 600 }}>
            ⚠️ {depositError}
          </Text>
        )}

        {depositSuccess && (
          <Text type="supporting" style={{ color: 'var(--color-text-success)', fontWeight: 600 }}>
            ✅ {depositSuccess}
          </Text>
        )}

        {/* Info Rekening Bank Resmi Koperasi */}
        <Card style={{ padding: 14, backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid var(--color-primary-200)' }}>
          <VStack gap={2}>
            <Text type="supporting" weight="bold" color="primary">
              🏦 Rekening Tujuan Transfer Koperasi:
            </Text>
            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
              <VStack gap={0}>
                <Text type="body" weight="bold">
                  {profile?.coopBank?.bankName || 'Bank Mandiri'}: {profile?.coopBank?.accountNumber || '1060022716008'}
                </Text>
                <Text type="supporting" color="secondary">
                  a.n. {profile?.coopBank?.accountName || 'Koperasi Jasa Nusa Sejahtera Prima'}
                </Text>
              </VStack>
              <Text type="supporting" size="sm" color="secondary">
                Pastikan nominal transfer sesuai dengan mutasi rekening.
              </Text>
            </HStack>
          </VStack>
        </Card>

        <Grid gap={4}>
          <Selector
            label="Jenis Simpanan"
            value={depositSavingsType}
            onChange={(val) => setDepositSavingsType(val as any)}
            options={[
              {
                value: 'pokok',
                label: `Simpanan Pokok ${(profile?.simpananPokok || 0) >= 500000 ? '(Sudah Lunas Rp 500.000)' : `(Sisa: ${formatRp(500000 - (profile?.simpananPokok || 0))})`}`,
                disabled: (profile?.simpananPokok || 0) >= 500000,
              },
              { value: 'wajib', label: 'Simpanan Wajib' },
              { value: 'sukarela', label: 'Simpanan Sukarela' },
            ]}
            width="100%"
          />

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nominal Setoran (Rp):</Text>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 100.000"
              value={depositAmount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setDepositAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
              }}
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
              required
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Tanggal Transfer:</Text>
            <input
              type="date"
              value={depositTransferDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDepositTransferDate(e.target.value)}
              style={inputStyle}
              required
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Bank Pengirim (Opsional):</Text>
            <input
              type="text"
              placeholder="Contoh: Bank Mandiri / BCA / BRI"
              value={depositSenderBank}
              onChange={(e) => setDepositSenderBank(e.target.value)}
              style={inputStyle}
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nomor Rekening Pengirim (Opsional):</Text>
            <input
              type="text"
              placeholder="Contoh: 1234567890"
              value={depositSenderAccount}
              onChange={(e) => setDepositSenderAccount(e.target.value)}
              style={inputStyle}
            />
          </VStack>

          <VStack gap={2}>
            <Text type="supporting" weight="semibold">Nama Pemilik Rekening Pengirim (Opsional):</Text>
            <input
              type="text"
              placeholder="Nama pengirim sesuai rekening"
              value={depositSenderName}
              onChange={(e) => setDepositSenderName(e.target.value)}
              style={inputStyle}
            />
          </VStack>
        </Grid>

        {/* Bukti Transfer (Opsional) */}
        <VStack gap={2}>
          <Text type="supporting" weight="semibold">
            Unggah Bukti Transfer / Resi ATM / Tangkapan Layar (Opsional):
          </Text>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <input
              type="file"
              id="deposit-proof-file"
              accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
              onChange={handleUploadDepositProof}
              disabled={depositUploadingProof}
              style={{ fontSize: 14 }}
            />
            {depositUploadingProof && (
              <HStack gap={1} vAlign="center">
                <Spinner size="sm" />
                <Text type="supporting" color="secondary">Mengunggah file...</Text>
              </HStack>
            )}
            {depositProofUrl && !depositUploadingProof && (
              <HStack gap={2} vAlign="center">
                <Text type="supporting" weight="medium" style={{ color: 'var(--color-text-success)' }}>
                  ✓ Bukti terunggah: {depositProofName}
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDepositProofUrl('');
                    setDepositProofName('');
                  }}
                  label="Hapus"
                />
              </HStack>
            )}
          </HStack>
          <Text type="supporting" size="sm" color="secondary">
            Format: JPG, PNG, WEBP, atau PDF. Maksimal 5MB. Unggah bukti bersifat opsional namun membantu mempercepat verifikasi bendahara.
          </Text>
        </VStack>

        <VStack gap={2}>
          <Text type="supporting">Catatan Tambahan (Opsional):</Text>
          <input
            type="text"
            placeholder="Contoh: Setoran simpanan wajib bulan September 2026"
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            style={inputStyle}
          />
        </VStack>

        <HStack justify="end" gap={2}>
          <Button
            label="Batal"
            variant="ghost"
            onClick={onClose}
            isDisabled={depositLoading || depositUploadingProof}
          />
          <Button
            label={depositLoading ? 'Mengirim Konfirmasi...' : 'Kirim Konfirmasi Setoran'}
            variant="primary"
            type="submit"
            isDisabled={depositLoading || depositUploadingProof}
          />
        </HStack>
      </form>
    </Card>
  );
};
