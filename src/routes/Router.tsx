import { Routes, Route } from 'react-router-dom';
import SignIn from '@/pages/public/SignIn/SignIn';
import ProtectedRoute from '@/routes/ProtectedRoutes';
import Dashboard from '@/pages/secure/Dashboard/Dashboard';
import AASEditor from '@/pages/secure/AASEditor/AASEditor';
import AASLifecycle from '@/pages/secure/AASLifecycle/AASLifecycle';
import AASServer from '@/pages/secure/AASServer/AASServer';

const Router = () => (
  <Routes>
    <Route path="/" element={<SignIn />} />
    <Route
      path="dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="editor"
      element={
        <ProtectedRoute>
          <AASEditor />
        </ProtectedRoute>
      }
    />
    <Route
      path="lifecycle"
      element={
        <ProtectedRoute>
          <AASLifecycle />
        </ProtectedRoute>
      }
    />
    <Route
      path="server"
      element={
        <ProtectedRoute>
          <AASServer />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<SignIn />} />
  </Routes>
);

export default Router;
