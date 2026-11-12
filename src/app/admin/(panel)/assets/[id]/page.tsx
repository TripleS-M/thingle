import type { Metadata } from 'next';
import AssetEditor from '@/components/admin/AssetEditor';

export const metadata: Metadata = { title: 'Configure model' };

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetEditor key={id} id={id} />;
}
