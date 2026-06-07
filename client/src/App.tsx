import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Registry from './pages/Registry';
import DocumentDetails from './pages/DocumentDetails';
import NewDocument from './pages/NewDocument';
import Profile from './pages/Profile';
import Users from './pages/admin/Users';
import Departments from './pages/admin/Departments';
import DocumentTypes from './pages/admin/DocumentTypes';
import AuditLog from './pages/admin/AuditLog';
import Settings from './pages/admin/Settings';
import Delegations from './pages/Delegations';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="registry" element={<Registry />} />
        <Route path="document/:id" element={<DocumentDetails />} />
        <Route path="new-document" element={<NewDocument />} />
        <Route path="profile" element={<Profile />} />
        <Route path="delegations" element={<Delegations />} />
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/departments" element={<Departments />} />
        <Route path="admin/types" element={<DocumentTypes />} />
        <Route path="admin/audit" element={<AuditLog />} />
        <Route path="admin/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
