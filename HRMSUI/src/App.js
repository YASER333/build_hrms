import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './Layout/Layout';
import Dashboard from './Pages/Dashboard/Dashboard';
import Organisation from './Pages/Dashboard/Organisation';
import HrOnboarding from './Pages/Dashboard/HrOnboarding';
import LeaveRequest from './Pages/Dashboard/LeaveRequest';
import Mis from './Pages/Dashboard/Mis';
import Payslip from './Pages/Dashboard/Payslip';
import UserManagement from './Pages/Dashboard/UserManagement';
import Attendance from './Pages/Dashboard/Attendance';
import Epfo from './Pages/Dashboard/Epfo';
import Login from './view/Login';
import ProjectManagement from './Pages/Dashboard/ProjectManagement';
import AssetManagement from './Pages/Dashboard/AssetManagement';


function AppRoutes() {

  const { user, loading } = useAuth();

  // Auth data loading
  if (loading) {
    return <div>Loading...</div>;
  }

  const isAuthenticated = !!user;

  return (
    <Routes>

      {/* LOGIN */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />


      {/* PROTECTED ROUTES */}
      {isAuthenticated ? (

        <Route path="/" element={<Layout />}>

          <Route
            index
            element={<Navigate to="/dashboard" replace />}
          />

          <Route path="dashboard" element={<Dashboard />} />

          <Route path="organisation" element={<Organisation />} />

          <Route path="onboarding" element={<HrOnboarding />} />

          <Route path="leave" element={<LeaveRequest />} />

          <Route path="mis" element={<Mis />} />

          <Route path="payslip" element={<Payslip />} />

          <Route path="users" element={<UserManagement />} />

          <Route path="roles" element={<UserManagement />} />

          <Route path="assets" element={<AssetManagement />} />

          <Route path="attendance" element={<Attendance />} />

          <Route
            path="projects"
            element={<ProjectManagement />}
          />

          <Route path="epfo" element={<Epfo />} />

        </Route>

      ) : (

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      )}

    </Routes>
  );
}


function App() {

  return (

    <AuthProvider>

      <HashRouter>

        <AppRoutes />

      </HashRouter>

    </AuthProvider>

  );

}

export default App;