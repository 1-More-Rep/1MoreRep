import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { listPhotos } from '@/server/services/photoService';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/typography';
import { PhotoUpload } from '@/components/progress/PhotoUpload';

export const dynamic = 'force-dynamic';

export default async function ProgressPhotosPage() {
  const user = await requireUser();
  const photos = await listPhotos(user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/progress" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Progress</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Progress photos</h1>

      <Card><PhotoUpload /></Card>

      <SectionLabel>{photos.length} photo{photos.length === 1 ? '' : 's'}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`/api/photos/${p.id}`}
            alt={`Progress ${p.takenAt.toISOString().slice(0, 10)}`}
            width={p.width}
            height={p.height}
            loading="lazy"
            style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}
          />
        ))}
      </div>
    </div>
  );
}
