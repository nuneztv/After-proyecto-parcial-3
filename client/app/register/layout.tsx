import type { ReactNode } from 'react';
import { GuestRoute } from '@/components/GuestRoute/GuestRoute';

// Signed-in users never see the sign-up form: GuestRoute sends them to /home
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}
