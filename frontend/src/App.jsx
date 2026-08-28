import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./layouts/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PERMISSIONS } from "./utils/access";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Categories = lazy(() => import("./pages/Categories"));
const RNC = lazy(() => import("./pages/RNC"));
const Nfs = lazy(() => import("./pages/Nfs"));
const Audit = lazy(() => import("./pages/Audit"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));

function PageFallback() {
  return (
    <div className="route-loading" aria-live="polite">
      Carregando...
    </div>
  );
}

function ProtectedPage({ permissions = [], roles = [], children }) {
  return (
    <ProtectedRoute permissions={permissions} roles={roles}>
      <Layout>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedPage permissions={[PERMISSIONS.DASHBOARD_VIEW]}>
              <Dashboard />
            </ProtectedPage>
          }
        />

        <Route
          path="/suppliers"
          element={
            <ProtectedPage permissions={[PERMISSIONS.SUPPLIERS_VIEW]}>
              <Suppliers />
            </ProtectedPage>
          }
        />

        <Route
          path="/evaluations"
          element={
            <ProtectedPage permissions={[PERMISSIONS.SUPPLIERS_EVALUATE]}>
              <Evaluations />
            </ProtectedPage>
          }
        />

        <Route
          path="/categories"
          element={
            <ProtectedPage permissions={[PERMISSIONS.CATEGORIES_VIEW]}>
              <Categories />
            </ProtectedPage>
          }
        />

        <Route
          path="/rnc"
          element={
            <ProtectedPage permissions={[PERMISSIONS.RNC_VIEW]}>
              <RNC />
            </ProtectedPage>
          }
        />

        <Route
          path="/nfs"
          element={
            <ProtectedPage permissions={[PERMISSIONS.NFS_VIEW]}>
              <Nfs />
            </ProtectedPage>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedPage permissions={[PERMISSIONS.AUDIT_VIEW]}>
              <Audit />
            </ProtectedPage>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedPage permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ADMIN_DASHBOARD_VIEW]}>
              <AdminPortal />
            </ProtectedPage>
          }
        />

        <Route
          path="/admin/usuarios"
          element={
            <ProtectedPage permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_VIEW]}>
              <AdminPortal />
            </ProtectedPage>
          }
        />

        <Route
          path="/admin/admins"
          element={
            <ProtectedPage permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ADMINS_VIEW]}>
              <AdminPortal />
            </ProtectedPage>
          }
        />

        <Route
          path="/admin/departamentos"
          element={
            <ProtectedPage permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.DEPARTMENTS_VIEW]}>
              <AdminPortal />
            </ProtectedPage>
          }
        />

        <Route
          path="/admin/configuracoes"
          element={
            <ProtectedPage permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SETTINGS_VIEW]}>
              <AdminPortal />
            </ProtectedPage>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
