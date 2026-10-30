import React, { useState, useRef } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { formatRp } from '../../../utils/format';
import { Grid } from './Grid';
import type { MemberProfile } from '../types';

interface ApplyLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: MemberProfile | null;
  portalToken: string | null;
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

export const ApplyLoanModal: React.FC<ApplyLoanModalProps> = ({
  isOpen,
  onClose,
  profile,
  portalToken,
  onSuccess,
}) => {
  const [applyAmount, setApplyAmount] = useState('');
  const [applyTenor, setApplyTenor] = useState('12');
  const [applyPurpose, setApplyPurpose] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentSize, setAttachmentSize] = useState<number>(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentError('');
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('Ukuran file maksimal adalah 10 MB');
      return;
    }
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setAttachmentError('Format file hanya boleh PDF, JPG, PNG, atau WebP');
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/upload/loan-attachment', {
        method: 'POST',
        headers: portalToken ? { Authorization: `Bearer ${portalToken}` } : {},
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data?.url) {
        setAttachmentUrl(res.data.url);
        setAttachmentName(res.data.name || file.name);
        setAttachmentSize(file.size);
      } else {
        setAttachmentError(res.message || 'Gagal mengunggah file lampiran');
      }
    } catch {
      setAttachmentError('Terjadi kesalahan saat mengunggah file');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalToken) return;
    setApplyLoading(true);
    setApplyError('');
    setApplySuccess('');
    try {
      if (!attachmentUrl) {
        setApplyError('Lampiran dokumen pendukung wajib diunggah');
        setApplyLoading(false);
        return;
      }
      const numericAmount = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${portalToken}`,
      };
      const res = await fetch('/api/v1/portal/loans/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: numericAmount,
          tenor: parseInt(applyTenor, 10),
          purpose: applyPurpose,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setApplySuccess(res.message || 'Pengajuan pinjaman berhasil dikirim!');
        setApplyAmount('');
        setApplyPurpose('');
        setAttachmentUrl('');
        setAttachmentName('');
        setAttachmentSize(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onSuccess();
        setTimeout(() => {
          onClose();
          setApplySuccess('');
        }, 2000);
      } else {
        setApplyError(res.message || 'Gagal mengajukan pinjaman');
      }
    } catch {
      setApplyError('Terjadi kesalahan jaringan');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
      <form onSubmit={handleApplyLoan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading level={4}>Formulir Pengajuan Pinjaman Baru</Heading>

        {applyError ? (
          <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 600 }}>
            ⚠️ {applyError}
          </Text>
        ) : null}

        {applySuccess ? (
          <Text type="supporting" style={{ color: 'var(--color-text-success)', fontWeight: 600 }}>
            ✅ {applySuccess}
          </Text>
        ) : null}

        <Grid gap={4}>
          <VStack gap={2}>
            <Text type="supporting">Nominal Pinjaman (Rp)</Text>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 5.000.000"
              value={applyAmount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setApplyAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
              }}
              style={inputStyle}
              required
            />
          </VStack>

          <Selector
            label="Tenor (Bulan)"
            value={applyTenor}
            onChange={setApplyTenor}
            options={Array.from({ length: 24 }, (_, i) => i + 1).map((m) => ({
              value: String(m),
              label: `${m} Bulan${m === 12 ? ' (1 Tahun)' : m === 24 ? ' (2 Tahun)' : ''}`,
            }))}
            width="100%"
          />
        </Grid>

        <VStack gap={2}>
          <Text type="supporting">Keperluan / Tujuan Pinjaman</Text>
          <textarea
            rows={3}
            placeholder="Jelaskan keperluan pengajuan pinjaman (contoh: Biaya pendidikan, Renovasi rumah, Modal usaha)"
            value={applyPurpose}
            onChange={(e) => setApplyPurpose(e.target.value)}
            style={inputStyle}
            required
          />
        </VStack>

        {/* Lampiran Dokumen Pendukung */}
        <VStack gap={2}>
          <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
            <Text type="supporting">Lampiran Dokumen Pendukung (Wajib)</Text>
            <Text type="supporting" size="sm" color="secondary">
              PDF, JPG, PNG, WEBP (Maks. 10 MB)
            </Text>
          </HStack>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="loan-attachment-input"
          />

          {!attachmentUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--color-border-primary)',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                cursor: uploadingAttachment ? 'wait' : 'pointer',
                backgroundColor: 'var(--color-background-primary)',
                transition: 'all 0.2s ease',
              }}
            >
              <VStack gap={2} vAlign="center">
                <Text type="body" weight="semibold">
                  {uploadingAttachment ? '⏳ Sedang mengunggah file...' : '📎 Klik untuk Unggah Dokumen / Foto Pendukung'}
                </Text>
                <VStack gap={1} vAlign="center" style={{ maxWidth: '520px' }}>
                  <Text type="supporting" size="sm" color="secondary" weight="semibold">
                    Contoh dokumen yang dapat diunggah sesuai tujuan pinjaman:
                  </Text>
                  <VStack gap={1} vAlign="start" style={{ textAlign: 'left', width: '100%', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <div>• <strong>Kuitansi / Bukti Tagihan / Invoice</strong> (Pembelian barang, biaya pendidikan/kesehatan)</div>
                    <div>• <strong>Foto Kondisi Rumah</strong> (Untuk renovasi / perbaikan rumah)</div>
                    <div>• <strong>Laporan SLIK OJK / Dokumen Penunjang Lainnya</strong></div>
                  </VStack>
                </VStack>
              </VStack>
            </div>
          ) : (
            <Card style={{ padding: 12, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack vAlign="center" gap={2}>
                  <span style={{ fontSize: '24px' }}>
                    {attachmentName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                  </span>
                  <VStack gap={0}>
                    <Text type="body" weight="bold">{attachmentName}</Text>
                    <Text type="supporting" size="sm" color="secondary">
                      {attachmentSize ? `${(attachmentSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                      Lampiran siap dikirim
                    </Text>
                  </VStack>
                </HStack>
                <HStack gap={2}>
                  <Button
                    label="Lihat File"
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => window.open(attachmentUrl, '_blank')}
                  />
                  <Button
                    label="Hapus"
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setAttachmentUrl('');
                      setAttachmentName('');
                      setAttachmentSize(0);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                </HStack>
              </HStack>
            </Card>
          )}

          {attachmentError && (
            <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 500 }}>
              ⚠️ {attachmentError}
            </Text>
          )}
        </VStack>

        {/* Estimasi Simulasi */}
        {parseFloat(applyAmount.replace(/\D/g, '')) > 0 && (
          <Card style={{ padding: 16, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
            <VStack gap={2}>
              <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                <Text type="supporting" color="secondary">
                  Estimasi Angsuran Per Bulan
                </Text>
              </HStack>
              <HStack justify="between" wrap="wrap" gap={2} style={{ alignItems: 'baseline' }}>
                <VStack gap={0}>
                  <Heading level={3} color="primary">
                    {(() => {
                      const P = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
                      const n = parseInt(applyTenor, 10) || 12;
                      const annualRate = Number(profile?.loanInterestRate ?? 9.1);
                      if (annualRate <= 0) return formatRp(Math.ceil(P / n));
                      const i = annualRate / 1200;
                      const power = Math.pow(1 + i, n);
                      const pmt = Math.ceil((P * (i * power)) / (power - 1));
                      return formatRp(pmt);
                    })()}
                    <Text type="supporting" color="secondary" style={{ display: 'inline', marginLeft: 6 }}>/ bulan</Text>
                  </Heading>
                </VStack>
                <Text type="supporting" size="sm" color="secondary">
                  Total Pengembalian: {(() => {
                    const P = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
                    const n = parseInt(applyTenor, 10) || 12;
                    const annualRate = Number(profile?.loanInterestRate ?? 9.1);
                    if (annualRate <= 0) return formatRp(P);
                    const i = annualRate / 1200;
                    const power = Math.pow(1 + i, n);
                    const pmt = Math.ceil((P * (i * power)) / (power - 1));
                    return formatRp(pmt * n);
                  })()} (Tenor {applyTenor} Bulan)
                </Text>
              </HStack>
            </VStack>
          </Card>
        )}

        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
          {!attachmentUrl ? (
            <Text type="supporting" size="sm" style={{ color: 'var(--color-text-error)' }}>
              * Lampiran dokumen pendukung wajib diunggah
            </Text>
          ) : <div />}
          <HStack gap={3} justify="end">
            <Button
              label="Batal"
              variant="ghost"
              type="button"
              onClick={onClose}
              isDisabled={applyLoading}
            />
            <Button
              label={applyLoading ? 'Mengirim...' : 'Ajukan Pinjaman Sekarang'}
              variant="primary"
              type="submit"
              isDisabled={applyLoading || !attachmentUrl}
            />
          </HStack>
        </HStack>
      </form>
    </Card>
  );
};
