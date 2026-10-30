import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/lib/ProtectedRoute';
import RoleGate from '@/components/ev/RoleGate';
import Layout from '@/components/Layout';

// Auth & public pages
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// EV owner workspace
import Dashboard from '@/pages/Dashboard';
import Discover from '@/pages/Discover';
import StationDetail from '@/pages/StationDetail';
import Vehicles from '@/pages/Vehicles';
import Bookings from '@/pages/Bookings';
import Sessions from '@/pages/Sessions';
import EnergyMonitoring from '@/pages/EnergyMonitoring';
import Payments from '@/pages/Payments';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';

// Operator workspace
import OperatorDashboard from '@/pages/operator/OperatorDashboard';
import OperatorStations from '@/pages/operator/Stations';
import ChargingPoints from '@/pages/operator/ChargingPoints';
import Tariffs from '@/pages/operator/Tariffs';

// Technician workspace
import TechnicianDashboard from '@/pages/technician/TechnicianDashboard';
import Maintenance from '@/pages/maintenance/Maintenance';

// Administration
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminOperators from '@/pages/admin/AdminOperators';
import AuditLog from '@/pages/admin/AuditLog';
import SystemDocs from '@/pages/admin/SystemDocs';
import Reports from '@/pages/reports/Reports';

const SessionGate = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/stations/:id" element={<StationDetail />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/energy" element={<EnergyMonitoring />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />

          <Route element={<RoleGate roles={['operator', 'admin']} />}>
            <Route path="/operator" element={<OperatorDashboard />} />
            <Route path="/operator/stations" element={<OperatorStations />} />
            <Route path="/operator/points" element={<ChargingPoints />} />
            <Route path="/operator/tariffs" element={<Tariffs />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route element={<RoleGate roles={['technician', 'operator', 'admin']} />}>
            <Route path="/technician" element={<TechnicianDashboard />} />
            <Route path="/maintenance" element={<Maintenance />} />
          </Route>

          <Route element={<RoleGate roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/operators" element={<AdminOperators />} />
            <Route path="/admin/audit" element={<AuditLog />} />
            <Route path="/admin/docs" element={<SystemDocs />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <SessionGate />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
