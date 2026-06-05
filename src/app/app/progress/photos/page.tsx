import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { listPhotos } from '@/server/services/photoService';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/typography';
import { PhotoUpload } from '@/components/progress/PhotoUpload';
import { PhotoGrid } from '@/components/progress/PhotoGrid';
import { PhotoCompare } from '@/components/progress/PhotoCompare';

export const dynamic = 'force-dynamic';

export default async function ProgressPhotosPage() {
  const t = await getTranslations('progress');
  const user = await requireUser();
  const photos = await listPhotos(user.id);
  const lite = photos.map((p) => ({ id: p.id, width: p.width, height: p.height, takenAt: p.takenAt.toISOString() }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/progress" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('title')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('photosTitle')}</h1>

      <Card><PhotoUpload /></Card>

      {lite.length >= 2 && (
        <Card>
          <SectionLabel style={{ marginBottom: 10 }}>{t('compare')}</SectionLabel>
          <PhotoCompare photos={lite} />
        </Card>
      )}

      <SectionLabel>{t('photoCount', { count: photos.length })}</SectionLabel>
      <PhotoGrid photos={lite} />
    </div>
  );
}
