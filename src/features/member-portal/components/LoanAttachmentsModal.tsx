import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Heading, Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatRp } from '../../../utils/format';
import { getAuthenticatedFileUrl } from '../../../utils/fileUrl';
import type { PortalLoan } from '../types';

export interface AttachmentItem {
  id: string;
  loanId: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  isSupplemental: boolean;
  uploadedBy: string;
  createdAt: string;
}

interface LoanAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: PortalLoan | null;
  portalToken: string | null;
  onUpdate?: () => void;
}

export const LoanAttachmentsModal: React.FC<LoanAttachmentsModalProps> = ({
  isOpen,
  onClose,
  loan,
  portalToken,
  onUpdate,
}) => {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    if (!loan || !portalToken) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/portal/loans/${loan.id}/attachments`, {
        headers: { Authorization: `Bearer ${portalToken}` },
      }).then((r) => r.json());

      if (res.success && Array.isArray(res.data)) {
        setAttachments(res.data);
      } else {
        // Fallback to legacy loan attachment if endpoint returns empty
        if (loan.attachmentUrl) {
          setAttachments([
            {
              id: `legacy-${loan.id}`,
              loanId: loan.id,
              fileName: loan.attachmentName || 'Dokumen Lampiran',
              fileUrl: loan.attachmentUrl,
              fileSize: null,
              isSupplemental: false,
              uploadedBy: 'member',
              createdAt: loan.createdAt,
            },
          ]);
        } else {
          setAttachments([]);
        }
      }
    } catch {
      setError('Gagal memuat daftar dokumen lampiran');
    } finally {
      setIsLoading(false);
    }
  }, [loan, portalToken]);

  useEffect(() => {
    if (isOpen && loan) {
      setError('');
      setSuccess('');
      fetchAttachments();
    }
  }, [isOpen, loan, fetchAttachments]);

  if (!isOpen || !loan) return null;

  const canAddSupplemental = loan.status === 'Menunggu';

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !portalToken) return;
    setError('');
    setSuccess('');

    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal adalah 10 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError('Format file hanya boleh PDF, JPG, PNG, atau WebP');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/v1/upload/loan-attachment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${portalToken}` },
        body: formData,
      }).then((r) => r.json());

      if (!uploadRes.success || !uploadRes.data?.url) {
        setError(uploadRes.message || 'Gagal mengunggah file lampiran');
        setUploading(false);
        return;
      }

      // Attach file to loan
      const attachRes = await fetch(`/api/v1/portal/loans/${loan.id}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${portalToken}`,
        },
        body: JSON.stringify({
          url: uploadRes.data.url,
          name: uploadRes.data.name || file.name,
          size: file.size,
        }),
      }).then((r) => r.json());

      if (attachRes.success) {
        setSuccess('Dokumen susulan berhasil ditambahkan!');
        await fetchAttachments();
        if (onUpdate) onUpdate();
      } else {
        setError(attachRes.message || 'Gagal menambahkan dokumen susulan');
      }
    } catch {
      setError('Terjadi kesalahan saat mengunggah dokumen susulan');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!portalToken) return;
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen susulan ini?')) return;
    setError('');
    setSuccess('');
    setDeletingId(attachmentId);

    try {
      const res = await fetch(`/api/v1/portal/loans/${loan.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${portalToken}` },
      }).then((r) => r.json());

      if (res.success) {
        setSuccess('Dokumen susulan berhasil dihapus.');
        await fetchAttachments();
        if (onUpdate) onUpdate();
      } else {
        setError(res.message || 'Gagal menghapus dokumen susulan');
      }
    } catch {
      setError('Terjadi kesalahan saat menghapus dokumen susulan');
    } finally {
      setDeletingId(null);
    }
  };

  const initialDocs = attachments.filter((a) => !a.isSupplemental);
  const supplementalDocs = attachments.filter((a) => a.isSupplemental);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card style={{ padding: 20, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
          <VStack gap={4}>
            <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
              <VStack gap={0}>
                <Heading level={4}>Dokumen Lampiran Pengajuan Pinjaman</Heading>
                <Text type="supporting" color="secondary">
                  {loan.purpose} • {formatRp(loan.amount)}
                </Text>
              </VStack>
              <StatusBadge status={loan.status} />
            </HStack>

            {error && (
              <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 600 }}>
                ⚠️ {error}
              </Text>
            )}

            {success && (
              <Text type="supporting" style={{ color: 'var(--color-text-success)', fontWeight: 600 }}>
                ✅ {success}
              </Text>
            )}

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Spinner size="md" />
              </div>
            ) : (
              <VStack gap={3}>
                {/* Dokumen Utama / Awal */}
                <VStack gap={2}>
                  <Text weight="bold" size="sm" color="secondary">
                    DOKUMEN UTAMA / AWAL ({initialDocs.length})
                  </Text>
                  {initialDocs.length === 0 ? (
                    <Text type="supporting" color="secondary">Tidak ada dokumen utama.</Text>
                  ) : (
                    initialDocs.map((doc) => (
                      <Card key={doc.id} style={{ padding: 10, backgroundColor: 'var(--color-background-secondary)' }}>
                        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                          <HStack vAlign="center" gap={2}>
                            <span style={{ fontSize: '20px' }}>
                              {doc.fileName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                            </span>
                            <VStack gap={0}>
                              <Text weight="semibold" size="sm">{doc.fileName}</Text>
                              <Text type="supporting" size="sm" color="secondary">
                                {doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                                Dokumen Utama
                              </Text>
                            </VStack>
                          </HStack>
                          <Button
                            label="Lihat File"
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(getAuthenticatedFileUrl(doc.fileUrl), '_blank')}
                          />
                        </HStack>
                      </Card>
                    ))
                  )}
                </VStack>

                {/* Dokumen Susulan / Tambahan */}
                <VStack gap={2}>
                  <Text weight="bold" size="sm" color="secondary">
                    DOKUMEN SUSULAN / TAMBAHAN ({supplementalDocs.length})
                  </Text>
                  {supplementalDocs.length === 0 ? (
                    <Text type="supporting" color="secondary">Belum ada dokumen susulan.</Text>
                  ) : (
                    supplementalDocs.map((doc) => (
                      <Card key={doc.id} style={{ padding: 10, backgroundColor: 'var(--color-background-secondary)' }}>
                        <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                          <HStack vAlign="center" gap={2}>
                            <span style={{ fontSize: '20px' }}>
                              {doc.fileName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                            </span>
                            <VStack gap={0}>
                              <Text weight="semibold" size="sm">{doc.fileName}</Text>
                              <Text type="supporting" size="sm" color="secondary">
                                {doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                                Diunggah: {new Date(doc.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </VStack>
                          </HStack>
                          <HStack gap={2}>
                            <Button
                              label="Lihat File"
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(getAuthenticatedFileUrl(doc.fileUrl), '_blank')}
                            />
                            {canAddSupplemental && (
                              <Button
                                label={deletingId === doc.id ? 'Menghapus...' : 'Hapus'}
                                size="sm"
                                variant="ghost"
                                isDisabled={deletingId === doc.id}
                                onClick={() => handleDeleteAttachment(doc.id)}
                              />
                            )}
                          </HStack>
                        </HStack>
                      </Card>
                    ))
                  )}
                </VStack>

                {/* Upload Dokumen Susulan (hanya jika status Menunggu) */}
                {canAddSupplemental && (
                  <VStack gap={2} style={{ marginTop: 8 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                      onChange={handleUploadFile}
                      style={{ display: 'none' }}
                      id="supplemental-file-input"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--color-border-primary)',
                        borderRadius: '8px',
                        padding: '14px',
                        textAlign: 'center',
                        cursor: uploading ? 'wait' : 'pointer',
                        backgroundColor: 'var(--color-background-secondary)',
                      }}
                    >
                      <Text type="body" weight="semibold">
                        {uploading ? '⏳ Sedang mengunggah dokumen susulan...' : '📎 + Unggah Dokumen Susulan / Pendukung Baru'}
                      </Text>
                      <Text type="supporting" size="sm" color="secondary">
                        PDF, JPG, PNG, WEBP (Maks. 10 MB per berkas)
                      </Text>
                    </div>
                  </VStack>
                )}
              </VStack>
            )}

            <HStack justify="end" style={{ marginTop: 8 }}>
              <Button label="Tutup" variant="secondary" onClick={onClose} />
            </HStack>
          </VStack>
        </Card>
      </div>
    </div>
  );
};
