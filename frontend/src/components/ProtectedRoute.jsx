import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getStoredToken, saveSupabaseSession } from "../utils/authStorage";

export default function ProtectedRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredToken()));

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      const token = getStoredToken();

      if (token) {
        if (isMounted) {
          setIsAuthenticated(true);
          setIsChecking(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;

      if (!isMounted) return;

      if (session) {
        saveSupabaseSession(session);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }

      setIsChecking(false);
    }

    validateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
