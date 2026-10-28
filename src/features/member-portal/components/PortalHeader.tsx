import React from 'react';
import { LayoutHeader, StackItem } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useThemeMode } from '../../../contexts/ThemeContext';
import type { MemberProfile } from '../types';

interface PortalHeaderProps {
  profile: MemberProfile | null;
  isPreview: boolean;
  previewName: string;
  onLogout: () => void;
  onExitPreview: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  profile,
  isPreview,
  previewName,
  onLogout,
  onExitPreview,
}) => {
  const { mode, setMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <>
      <LayoutHeader
        hasDivider
        padding={4}
        style={{
          backgroundColor: 'var(--color-background-primary)',
          borderBottom: '1px solid var(--color-border-primary)',
        }}
      >
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={1} style={{ margin: 0, color: 'var(--color-text-primary)' }}>
                Selamat Datang, {profile?.name}
              </Heading>
              <Text type="supporting" color="secondary">
                {profile?.memberId ? `No. Anggota: ${profile.memberId}` : 'Portal Layanan Mandiri Anggota'}
              </Text>
            </VStack>
          </StackItem>

          <HStack gap={2} vAlign="center">
            <IconButton
              label={isDark ? 'Mode Terang' : 'Mode Gelap'}
              icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
              variant="ghost"
              onClick={() => setMode(isDark ? 'light' : 'dark')}
            />
            <Button
              label={isPreview ? 'Tutup pratinjau' : 'Keluar'}
              onClick={onLogout}
              variant="secondary"
            />
          </HStack>
        </HStack>
      </LayoutHeader>

      {isPreview && (
        <Card
          style={{
            padding: 16,
            backgroundColor: 'var(--color-background-secondary)',
            border: '1px solid var(--color-warning-500, #f59e0b)',
            margin: '16px 16px 0 16px',
          }}
        >
          <HStack justify="between" vAlign="center" wrap="wrap" gap={3}>
            <VStack gap={1}>
              <Text type="body" weight="bold">
                Mode pratinjau admin
              </Text>
              <Text type="supporting" color="secondary">
                Anda melihat portal sebagai {previewName || profile?.name || 'anggota'}.
                Perubahan tidak disimpan ke sesi anggota. Token pratinjau berlaku ~15 menit.
              </Text>
            </VStack>
            <Button label="Kembali ke Admin" variant="primary" onClick={onExitPreview} />
          </HStack>
        </Card>
      )}
    </>
  );
};
