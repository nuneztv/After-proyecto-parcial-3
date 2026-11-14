'use client';

import { useProfile } from '@/contexts/admin/ProfileProvider';
import { BackButton } from '@/components/admin/BackButton/BackButton';
import { StatsGrid } from '@/components/admin/StatsGrid/StatsGrid';
import { MenuItem } from '@/components/admin/MenuItem/MenuItem';
import { CreateEventButton } from '@/components/admin/CreateEventButton/CreateEventButton';
import { EmptyState } from '@/components/admin/EmptyState/EmptyState';
import { LogoutButton } from '@/components/admin/LogoutButton/LogoutButton';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';

const ProfilePage = () => {
  const { profile, loading, error } = useProfile();

  return (
    <PrivateRoute>
      <div className="page page--no-nav">
        <header className="profile-header">
          <div className="profile-header__top">
            <BackButton href="/admin/overview" />
            <h1 className="profile-header__title">Profile</h1>
          </div>

          {loading && <EmptyState title="Loading profile..." />}
          {error && <EmptyState title="Something went wrong" subtitle={error} />}
          {profile && (
            <>
              {profile.avatar ? (
                // Supabase Storage URLs are not in next.config images, so a plain img is used
                <img src={profile.avatar} alt={profile.name} className="profile-header__photo" />
              ) : (
                <div className="profile-header__photo profile-header__initials" aria-hidden="true">
                  {profile.initials}
                </div>
              )}
              <h2 className="profile-header__name">{profile.name}</h2>
              <p className="profile-header__user">{profile.username}</p>
            </>
          )}
        </header>

        <StatsGrid />

        <div className="menu">
          <MenuItem icon="heart" title="My Events" subtitle="See your upcoming events" href="/admin/events" />
          <MenuItem icon="bell" title="Notifications" subtitle="Event updates and alerts" />
          <MenuItem icon="settings" title="Settings" subtitle="Location, privacy, preferences" />
          <MenuItem icon="help" title="Help & Support" subtitle="FAQ, contact us" />
        </div>

        <LogoutButton />

        <CreateEventButton />
      </div>
    </PrivateRoute>
  );
};

export default ProfilePage;
