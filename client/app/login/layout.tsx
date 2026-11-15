import type { ReactNode } from 'react';
import { GuestRoute } from '@/components/GuestRoute/GuestRoute';

// Signed-in users never see the login form: GuestRoute sends them to /home
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}
