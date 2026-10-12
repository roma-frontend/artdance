'use server';

import { domainErrors } from '@/domain/errors';

/** No public issuance of active passes before verified payment is integrated. */
export async function purchaseClassPassAction(formData: FormData): Promise<void> {
  void formData;
  throw domainErrors.featureDisabled();
}

export async function buyClassPass(passId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  void passId;
  return { ok: false, error: 'FEATURE_DISABLED' };
}
