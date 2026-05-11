import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../services/api";
import { getDefaultRouteForUser, hasPermission } from "../utils/access";
import {
  clearSession,
  getRememberMePreference,
  getStoredUser,
  saveSession
} from "../utils/authStorage";

export default function ProtectedRoute({ children, permissions = [], roles = [] }) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      const storedUser = getStoredUser();

      if (storedUser && isMounted) {
        setUser(storedUser);
      }

      try {
        const { data } = await api.get("/auth/me");

        saveSession({
          user: data,
          rememberMe: getRememberMePreference()
        });

        if (isMounted) {
          setUser(data);
        }
      } catch {
        clearSession();

        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    validateSession();

    function handleWindowFocus() {
      validateSession();
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [location.pathname]);

  if (isChecking) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles.length && !roles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (permissions.length && !permissions.every((item) => hasPermission(user, item))) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return children;
}
