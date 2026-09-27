import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';
import { Price } from '@/components/ui/price';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function BookingConfirmPage({ params }: { params: Promise<{ locale: string; holdId: string }> }) {
  const { holdId } = await params;
  void holdId;
  const caller = await getCaller();
  if (!caller) notFound();
  const booking = await db.booking.findUnique({ where: { id: holdId }, select: { id:true, reference:true, totalPrice:true, startsAt:true, endsAt:true, status:true, customerId:true } });
  const resolved = booking ?? await db.booking.findUnique({ where: { reference: holdId }, select: { id:true, reference:true, totalPrice:true, startsAt:true, endsAt:true, status:true, customerId:true } });
  if (!resolved || resolved.customerId !== caller.id) notFound();
  return (
    <main className="page-container inner-page">
      <h1 className="text-heading-2">Booking confirmed</h1>
      <p className="text-body mt-2 text-content-secondary">Reference {resolved.reference}</p>
      <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
        <div className="text-body-sm mt-2">{resolved.startsAt.toISOString()} — {resolved.endsAt.toISOString()}</div>
        <div className="mt-3"><Price amount={resolved.totalPrice} /></div>
      </div>
    </main>
  );
}
