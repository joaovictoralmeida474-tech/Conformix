import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Suppliers from "./pages/Suppliers";
import Categories from "./pages/Categories";
import RNC from "./pages/RNC";
import Audit from "./pages/Audit";
import AdminPortal from "./pages/AdminPortal";
import Layout from "./layouts/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PERMISSIONS } from "./utils/access";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.DASHBOARD_VIEW]}>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.SUPPLIERS_VIEW]}>
              <Layout>
                <Suppliers />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.CATEGORIES_VIEW]}>
              <Layout>
                <Categories />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rnc"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.RNC_VIEW]}>
              <Layout>
                <RNC />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.AUDIT_VIEW]}>
              <Layout>
                <Audit />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ADMIN_DASHBOARD_VIEW]}>
              <Layout>
                <AdminPortal />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_VIEW]}>
              <Layout>
                <AdminPortal />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/admins"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ADMINS_VIEW]}>
              <Layout>
                <AdminPortal />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/departamentos"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.DEPARTMENTS_VIEW]}>
              <Layout>
                <AdminPortal />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/configuracoes"
          element={
            <ProtectedRoute permissions={[PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SETTINGS_VIEW]}>
              <Layout>
                <AdminPortal />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
