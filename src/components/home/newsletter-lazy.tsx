'use client';

import dynamic from 'next/dynamic';
import type { Locale } from '@/i18n/config';

const NewsletterSection = dynamic(() => import('@/components/home/newsletter-section').then((m) => m.NewsletterSection), { ssr: false });

export function NewsletterLazy(props: { locale: Locale; source: 'home' | 'footer' | 'checkout' | 'account' }) {
  return <NewsletterSection {...props} />;
}
