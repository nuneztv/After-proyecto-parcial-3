'use client';

import { useAdminAuth } from '@/contexts/admin/AdminAuthProvider';
import { Icon } from '../Icon/Icon';

export const LogoutButton = () => {
  const { logout } = useAdminAuth();

  return (
    <button type="button" className="logout" onClick={logout}>
      <span className="menu-item__icon">
        <Icon name="logout" size={20} />
      </span>
      Log out
    </button>
  );
};
