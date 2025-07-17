// src/frontend/src/components/MainLayout.tsx
import { useEffect } from 'react';
import { InternalChatProvider } from '../contexts/InternalChatContext';
import { useAuth } from '../contexts/AuthContext';
import { MainLayoutContent } from './MainLayoutContent';
import '../styles/financial-design-system.css';

export function MainLayout() {
  const { user, token } = useAuth();

  // Apply financial theme class to body
  useEffect(() => {
    document.body.classList.add('financial-theme');
    return () => {
      document.body.classList.remove('financial-theme');
    };
  }, []);

  // Convert user to ChatUser format
  const chatUser = user ? {
    id: user.id,
    first_name: user.firstName || '',
    last_name: user.lastName || '',
    email: user.email,
    profile_image_url: user.profileImageUrl,
    job_title: user.jobTitle,
    department: user.department,
  } : null;

  return (
    <InternalChatProvider token={token} currentUser={chatUser}>
      <MainLayoutContent />
    </InternalChatProvider>
  );
}