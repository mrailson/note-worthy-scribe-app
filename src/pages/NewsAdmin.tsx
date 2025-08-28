import React from 'react';
import { Header } from '@/components/Header';
import { AdminNewsPanel } from '@/components/AdminNewsPanel';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const NewsAdmin = () => {
  return (
    <ProtectedRoute requiredModule="system_admin_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <AdminNewsPanel />
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default NewsAdmin;