/**
 * VERIFICATION (D-02) — бейдж inst-v: документы → модерация → isVerified.
 */

export function canGoVerified(docs: { status: string }[]): boolean {
  // Достаточно одного APPROVED документа
  return docs.some((d) => d.status === 'APPROVED');
}

export function verificationStatus(docs: { status: string }[]): 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NONE' {
  if (docs.length === 0) return 'NONE';
  if (docs.some((d) => d.status === 'APPROVED')) return 'VERIFIED';
  if (docs.some((d) => d.status === 'PENDING')) return 'PENDING';
  return 'REJECTED';
}
