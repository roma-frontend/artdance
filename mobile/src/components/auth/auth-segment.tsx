import { useRouter } from 'expo-router';

import { Segmented } from '@/components/ui/segmented';

export function AuthSegment({
  active,
  signInLabel,
  signUpLabel,
}: {
  active: 'sign-in' | 'sign-up';
  signInLabel: string;
  signUpLabel: string;
}) {
  const router = useRouter();
  return (
    <Segmented
      options={[
        { key: 'sign-in', label: signInLabel },
        { key: 'sign-up', label: signUpLabel },
      ]}
      value={active}
      onChange={(key) => router.replace(key === 'sign-in' ? '/sign-in' : '/sign-up')}
    />
  );
}
