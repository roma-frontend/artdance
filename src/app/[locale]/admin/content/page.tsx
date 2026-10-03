/**
 * CONTENT — CMS-lite (ContentBlock, Banner) — A-17.
 *
 * Контент главной управляется через ContentBlock (home-content.ts): кураторский
 * порядок, медиа-ключи и списки слагов. Сама страница — read-only обзор блоков
 * с их статусом и предпросмотром порядка; правка — через существующие ресурсы
 * админки (занятия, инструкторы, медиатека) и будущий редактор блоков.
 *
 * 4 состояния: loading.tsx (динамический сегмент), empty (нет блоков после сида),
 * error.tsx (раздел), denied — через capability content.manage / catalog.view.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AccessDenied } from '@/components/ui/access-denied';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminContentPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  const canView = can('content.manage') || can('catalog.view');
  if (!canView) return <AccessDenied />;

  const t = await getTranslations({ locale: locale as Locale, namespace: 'admin.content' });
  const tRoot = await getRootTranslate();

  const blocks = await db.contentBlock.findMany({
    orderBy: [{ order: 'asc' }, { key: 'asc' }],
    select: { key: true, locale: true, title: true, order: true, isActive: true, updatedAt: true },
    take: 100,
  });

  return (
    <>
      <AdminPageHeader titleKey="admin.content.title" subtitleKey="admin.content.subtitle" />

      <div className="flex flex-col gap-8">
        <section aria-labelledby="content-blocks" className="flex flex-col gap-4">
          <h2 id="content-blocks" className="text-card-title text-content-primary">
            {t('blocksTitle')}
          </h2>
          <p className="text-body-sm text-content-secondary">{t('blocksHint')}</p>

          {blocks.length === 0 ? (
            <EmptyState title={t('noBlocks')} description={t('noBlocksHint')} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('blocksKey')}</TableHead>
                    <TableHead>{tRoot('admin.fields.locale')}</TableHead>
                    <TableHead>{t('orderLabel')}</TableHead>
                    <TableHead>{tRoot('admin.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => (
                    <TableRow key={`${block.key}-${block.locale}`}>
                      <TableCell className="font-mono text-body-sm text-content-primary">{block.key}</TableCell>
                      <TableCell className="text-body-sm text-content-secondary">{block.locale}</TableCell>
                      <TableCell className="text-body-sm text-content-secondary">{block.order}</TableCell>
                      <TableCell>
                        <Badge variant={block.isActive ? 'success' : 'neutral'} size="sm">
                          {block.isActive ? t('statusActive') : t('statusInactive')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-caption text-content-tertiary">{t('previewHint')}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={routes.adminResource('media')}>{t('ctaManageBlocks')}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={routes.home()}>{tRoot('admin.backToSite')}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
