import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Suppliers from "./pages/Suppliers";
import Categories from "./pages/Categories";
import RNC from "./pages/RNC";
import Audit from "./pages/Audit";
import Layout from "./layouts/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { supabase } from "./services/supabase";
import { clearSession, getRememberMePreference, saveSupabaseSession } from "./utils/authStorage";

export default function App() {
  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (data?.session) {
        saveSupabaseSession(data.session, getRememberMePreference());
      } else {
        clearSession();
      }
    }

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        saveSupabaseSession(session, getRememberMePreference());
      } else {
        clearSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <Layout>
                <Suppliers />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Layout>
                <Categories />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rnc"
          element={
            <ProtectedRoute>
              <Layout>
                <RNC />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <Layout>
                <Audit />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
