import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { Card } from '@/components/ui/Card';
import { CreateExerciseForm } from '@/components/exercises/CreateExerciseForm';

export default async function NewExercisePage() {
  const t = await getTranslations('exercises');
  await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 560 }}>
      <Link href="/app/exercises" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
        ← {t('title')}
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('newExercise')}</h1>
      <Card>
        <CreateExerciseForm />
      </Card>
    </div>
  );
}
