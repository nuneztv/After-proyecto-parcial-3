import type { ReactNode } from 'react';
import { BottomNav } from '@/components/admin/BottomNav/BottomNav';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <PrivateRoute>
      <div className="page">
        <div className="page__scroll">{children}</div>
        <BottomNav />
      </div>
    </PrivateRoute>
  );
};

export default MainLayout;
