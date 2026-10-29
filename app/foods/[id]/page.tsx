import { redirect } from 'next/navigation';
export default async function FoodDetail({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/entries/${encodeURIComponent((await params).id)}`);
}
