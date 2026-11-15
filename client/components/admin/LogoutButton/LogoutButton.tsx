'use client';

import { useAdminAuth } from '@/contexts/admin/AdminAuthProvider';
import { Icon } from '../Icon/Icon';

export const LogoutButton = () => {
  const { logout, loggingOut } = useAdminAuth();

  return (
    <button
      type="button"
      className="logout"
      onClick={() => void logout()}
      disabled={loggingOut}
    >
      <span className="menu-item__icon">
        <Icon name="logout" size={20} />
      </span>
      {loggingOut ? 'Logging out...' : 'Log out'}
    </button>
  );
};
