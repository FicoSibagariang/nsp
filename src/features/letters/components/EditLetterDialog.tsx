import React, { useState, useEffect, useRef } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Grid } from '@astryxdesign/core/Grid';
import { Badge } from '@astryxdesign/core/Badge';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '../../../config';
import { formatDate } from '../../../utils/format';
import type { OfficialLetter, LetterCategory } from '../types';

interface EditLetterDialogProps {
  isOpen: boolean;
  letter: OfficialLetter | null;
  categories: LetterCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--color-border-primary)',
  backgroundColor: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

export function EditLetterDialog({
  isOpen,
  letter,
  categories,
  onClose,
  onSuccess,
}: EditLetterDialogProps) {
  const [editPartyName, setEditPartyName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState('');
  const [editAttachmentName, setEditAttachmentName] = useState('');
  const [editUploadingAttachment, setEditUploadingAttachment] = useState(false);
  const [editUploadError, setEditUploadError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  const [editFormSuccess, setEditFormSuccess] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (letter) {
      setEditPartyName(letter.partyName || '');
      setEditSubject(letter.subject || '');
      setEditDescription(letter.description || '');
      setEditAmount(letter.amount ? Number(letter.amount).toLocaleString('id-ID') : '');
      setEditAttachmentUrl(letter.attachmentUrl || '');
      setEditAttachmentName(letter.attachmentName || '');
      setEditUploadError('');
      setEditFormError('');
      setEditFormSuccess('');
    }
  }, [letter]);

  if (!isOpen || !letter) return null;

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploadError('');
    if (file.size > 10 * 1024 * 1024) {
      setEditUploadError('Ukuran file maksimal adalah 10 MB');
      return;
    }
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setEditUploadError('Hanya file PDF, JPG, PNG, dan WebP yang diizinkan');
      return;
    }

    setEditUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/v1/upload/loan-attachment', {
        method: 'POST',
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data?.url) {
        setEditAttachmentUrl(res.data.url);
        setEditAttachmentName(res.data.name || file.name);
      } else {
        setEditUploadError(res.message || 'Gagal mengunggah file lampiran');
      }
    } catch {
      setEditUploadError('Terjadi kesalahan jaringan saat mengunggah');
    } finally {
      setEditUploadingAttachment(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    setEditFormSuccess('');
    setEditSubmitting(true);

    try {
      const numericAmount = editAmount ? parseFloat(editAmount.replace(/\D/g, '')) : null;
      const res = await apiFetch(`/api/v1/letters/${letter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyName: editPartyName.trim(),
          subject: editSubject.trim(),
          description: editDescription.trim() || null,
          amount: numericAmount,
          attachmentUrl: editAttachmentUrl || null,
          attachmentName: editAttachmentName || null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setEditFormSuccess('Data surat berhasil diperbarui!');
        setTimeout(() => {
          onClose();
          setEditFormSuccess('');
          onSuccess();
        }, 1000);
      } else {
        setEditFormError(res.message || 'Gagal memperbarui data surat');
      }
    } catch {
      setEditFormError('Terjadi kesalahan jaringan');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-background-primary)',
          borderRadius: '12px',
          maxWidth: '650px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--color-border-primary)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Heading level={3} style={{ margin: 0 }}>
            Edit Data Surat Resmi
          </Heading>
          <IconButton
            icon={<Icon icon={XMarkIcon} />}
            label="Tutup Modal"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>

        <form onSubmit={handleSaveEdit} style={{ padding: '20px 24px' }}>
          <VStack gap={4}>
            {editFormError && (
              <Text type="supporting" style={{ color: 'var(--color-text-error)', fontWeight: 600 }}>
                ⚠️ {editFormError}
              </Text>
            )}
            {editFormSuccess && (
              <Text type="supporting" style={{ fontWeight: 600, color: 'var(--color-text-success)' }}>
                ✅ {editFormSuccess}
              </Text>
            )}

            {/* Informasi Nomor Surat Resmi & Kategori (Terkunci) */}
            <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <VStack gap={2}>
                <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
                  <VStack gap={0}>
                    <Text type="supporting" color="secondary" size="sm">
                      Nomor Surat Resmi (Terkunci):
                    </Text>
                    <Heading level={3} color="primary">
                      {letter.letterNumber}
                    </Heading>
                  </VStack>
                  <Badge
                    variant="info"
                    label={categories.find((c) => c.id === letter.category)?.label || letter.category}
                  />
                </HStack>
                <Text type="supporting" size="sm" color="secondary">
                  Tanggal Terbit: {formatDate(letter.letterDate)} • Nomor surat dan jenis surat dikunci untuk menjaga integritas agenda penomoran.
                </Text>
              </VStack>
            </Card>

            <Grid gap={4}>
              <VStack gap={2}>
                <Text type="supporting">Pihak Terkait (Nama Anggota / Lembaga / Bank / Peminjam)</Text>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso / PT Modal Bersama"
                  value={editPartyName}
                  onChange={(e) => setEditPartyName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </VStack>

              <VStack gap={2}>
                <Text type="supporting">Nilai Transaksi / Pokok Pinjaman (Opsional)</Text>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 10.000.000"
                  value={editAmount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setEditAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                  }}
                  style={inputStyle}
                />
              </VStack>
            </Grid>

            <VStack gap={2}>
              <Text type="supporting">Perihal Surat</Text>
              <input
                type="text"
                placeholder="Contoh: Surat Perjanjian Pinjaman Multiguna Anggota"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                style={inputStyle}
                required
              />
            </VStack>

            <VStack gap={2}>
              <Text type="supporting">Ringkasan / Catatan Tambahan (Keterangan)</Text>
              <textarea
                rows={3}
                placeholder="Keterangan jaminan, nomor rekening pencairan, atau klausul penting..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={inputStyle}
              />
            </VStack>

            {/* Unggah / Ganti Berkas Fisik */}
            <VStack gap={2}>
              <HStack justify="between" vAlign="center">
                <Text type="supporting">Lampiran Berkas Fisik / Scan Surat (Opsional)</Text>
                <Text type="supporting" size="sm" color="secondary">PDF / JPG / PNG (Maks 10 MB)</Text>
              </HStack>

              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                onChange={handleEditFileUpload}
                style={{ display: 'none' }}
              />

              {!editAttachmentUrl ? (
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--color-border-primary)',
                    borderRadius: '8px',
                    padding: '14px',
                    textAlign: 'center',
                    cursor: editUploadingAttachment ? 'wait' : 'pointer',
                    backgroundColor: 'var(--color-background-primary)',
                  }}
                >
                  <Text type="body" weight="semibold">
                    {editUploadingAttachment ? '⏳ Sedang mengunggah berkas...' : '📎 Klik untuk Unggah / Ganti Scan Berkas'}
                  </Text>
                </div>
              ) : (
                <Card style={{ padding: 12, backgroundColor: 'var(--color-background-secondary)' }}>
                  <HStack justify="between" vAlign="center">
                    <HStack vAlign="center" gap={2}>
                      <span>📄</span>
                      <Text type="body" weight="bold">{editAttachmentName || 'Lampiran Surat'}</Text>
                    </HStack>
                    <HStack gap={2}>
                      <Button
                        label="Lihat"
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(editAttachmentUrl, '_blank')}
                      />
                      <Button
                        label="Hapus"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditAttachmentUrl('');
                          setEditAttachmentName('');
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                      />
                    </HStack>
                  </HStack>
                </Card>
              )}

              {editUploadError && (
                <Text type="supporting" style={{ color: 'var(--color-text-error)' }}>⚠️ {editUploadError}</Text>
              )}
            </VStack>

            <HStack justify="end" gap={3} style={{ marginTop: 12 }}>
              <Button
                label="Batal"
                variant="ghost"
                type="button"
                onClick={onClose}
                isDisabled={editSubmitting}
              />
              <Button
                label={editSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                variant="primary"
                type="submit"
                isDisabled={editSubmitting}
              />
            </HStack>
          </VStack>
        </form>
      </div>
    </div>
  );
}
