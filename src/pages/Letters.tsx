'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Layout, LayoutHeader, LayoutContent, VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { PaperClipIcon, PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useApiQuery } from '../hooks/useApiQuery';
import { apiFetch } from '../config';
import { formatRp, formatDate } from '../utils/format';
import {
  LetterStatsCards,
  LetterFilterBar,
  CreateLetterDialog,
  EditLetterDialog,
  type OfficialLetter,
  type LetterCategory,
  type LettersResponse,
} from '../features/letters';

const DEFAULT_CATEGORIES: LetterCategory[] = [
  { id: 'PINJAMAN_ANGGOTA', code: 'SPP', label: 'Surat Perjanjian Pinjaman Anggota' },
  { id: 'PINJAMAN_MODAL', code: 'SPM', label: 'Surat Perjanjian Pinjaman Modal Masuk' },
  { id: 'SURAT_KELUAR', code: 'SK', label: 'Surat Keluar Umum' },
  { id: 'SURAT_KEPUTUSAN', code: 'SK-PENG', label: 'Surat Keputusan Pengurus' },
  { id: 'PERJANJIAN_KERJASAMA', code: 'SPK', label: 'Surat Perjanjian Kerjasama' },
];

export default function LettersPage() {
  const [page] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // Query categories
  const { data: catRes } = useApiQuery<LetterCategory[]>('/api/letters/categories');
  const categories = catRes || DEFAULT_CATEGORIES;

  // Query letters list
  const queryUrl = `/api/letters?page=${page}&limit=20&category=${selectedCategory}&year=${selectedYear}&search=${encodeURIComponent(searchQuery)}`;
  const { data: lettersRes, refetch } = useApiQuery<LettersResponse>(queryUrl);

  // Dialog state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLetter, setEditLetter] = useState<OfficialLetter | null>(null);

  const handleDeleteLetter = useCallback(async (letter: OfficialLetter) => {
    if (!window.confirm(`Yakin ingin menghapus arsip surat nomor '${letter.letterNumber}'?`)) return;
    try {
      const res = await apiFetch(`/api/v1/letters/${letter.id}`, { method: 'DELETE' }).then((r) => r.json());
      if (res.success) {
        refetch();
      } else {
        alert(res.message || 'Gagal menghapus surat');
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
  }, [refetch]);

  const handleOpenEdit = useCallback((letter: OfficialLetter) => {
    setEditLetter(letter);
    setShowEditModal(true);
  }, []);

  const columns: TableColumn<OfficialLetter>[] = useMemo(() => [
    {
      key: 'letterNumber',
      header: 'Nomor Surat Resmi',
      width: pixel(280),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body" weight="bold" color="primary" style={{ whiteSpace: 'nowrap' }}>
            {item.letterNumber}
          </Text>
          <Text type="supporting" size="sm" color="secondary" style={{ whiteSpace: 'nowrap' }}>
            Tgl Terbit: {formatDate(item.letterDate)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Jenis Surat',
      width: pixel(300),
      renderCell: (item) => {
        const cat = categories.find((c) => c.id === item.category);
        const isAnggota = item.category === 'PINJAMAN_ANGGOTA';
        const isModal = item.category === 'PINJAMAN_MODAL';
        return (
          <Badge
            variant={isAnggota ? 'info' : isModal ? 'warning' : 'neutral'}
            label={cat?.label || item.category}
          />
        );
      },
    },
    {
      key: 'partyName',
      header: 'Pihak Terkait (Debitur/Kreditur)',
      width: proportional(1),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body" weight="semibold">{item.partyName}</Text>
          {item.amount && item.amount > 0 ? (
            <Text type="supporting" size="sm" style={{ fontWeight: 600, color: 'var(--color-text-success)' }}>
              Nilai: {formatRp(item.amount)}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'subject',
      header: 'Perihal & Keterangan',
      width: proportional(1.5),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body">{item.subject}</Text>
          {item.description && (
            <Text type="supporting" size="sm" color="secondary">
              {item.description}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'attachment',
      header: 'File',
      width: pixel(70),
      renderCell: (item) => item.attachmentUrl ? (
        <IconButton
          icon={<Icon icon={PaperClipIcon} />}
          label="Buka File"
          tooltip={item.attachmentName ? `Buka ${item.attachmentName}` : 'Buka File'}
          size="sm"
          variant="secondary"
          onClick={() => window.open(item.attachmentUrl!, '_blank')}
        />
      ) : (
        <Text type="supporting" color="secondary">—</Text>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(90),
      renderCell: (item) => (
        <HStack gap={1}>
          <IconButton
            icon={<Icon icon={PencilIcon} />}
            label="Edit"
            tooltip="Edit"
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(item)}
          />
          <IconButton
            icon={<Icon icon={TrashIcon} />}
            label="Hapus"
            tooltip="Hapus"
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteLetter(item)}
          />
        </HStack>
      ),
    },
  ], [categories, handleOpenEdit, handleDeleteLetter]);

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider padding={4}>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <VStack gap={0}>
                <Heading level={1}>Buku Agenda &amp; Penomoran Surat Resmi</Heading>
                <Text type="supporting" color="secondary">
                  Penerbitan nomor surat resmi, perjanjian pinjaman anggota, dan perjanjian pinjaman modal (Anti Duplikasi).
                </Text>
              </VStack>
            </StackItem>
            <Button
              label="Terbitkan Nomor Surat"
              variant="primary"
              icon={<Icon icon={PlusIcon} size="sm" />}
              onClick={() => setShowCreateModal(true)}
            />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={6}>
            <LetterStatsCards stats={lettersRes?.stats} />

            <LetterFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              categories={categories}
              totalFound={lettersRes?.total || 0}
            />

            <Card>
              <Table
                data={lettersRes?.data || []}
                columns={columns}
                idKey="id"
                density="balanced"
              />
            </Card>
          </VStack>

          <CreateLetterDialog
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            categories={categories}
            onSuccess={() => refetch()}
          />

          <EditLetterDialog
            isOpen={showEditModal}
            letter={editLetter}
            categories={categories}
            onClose={() => {
              setShowEditModal(false);
              setEditLetter(null);
            }}
            onSuccess={() => refetch()}
          />
        </LayoutContent>
      }
    />
  );
}
