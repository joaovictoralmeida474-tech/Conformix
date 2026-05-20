import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../services/api";
import { getDefaultRouteForUser, hasPermission } from "../utils/access";
import {
  clearSession,
  getRememberMePreference,
  getStoredUser,
  saveSession
} from "../utils/authStorage";

const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function ProtectedRoute({ children, permissions = [], roles = [] }) {
  const [isChecking, setIsChecking] = useState(!getStoredUser());
  const [user, setUser] = useState(getStoredUser());
  const lastValidationRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function validateSession(force = false) {
      const now = Date.now();
      const storedUser = getStoredUser();

      if (storedUser && isMounted) {
        setUser(storedUser);
        setIsChecking(false);
      }

      if (!force && now - lastValidationRef.current < SESSION_CHECK_INTERVAL_MS && storedUser) {
        return;
      }

      lastValidationRef.current = now;

      try {
        const { data } = await api.get("/auth/me");

        saveSession({
          user: data,
          rememberMe: getRememberMePreference()
        });

        if (isMounted) {
          setUser(data);
          setIsChecking(false);
        }
      } catch {
        clearSession();

        if (isMounted) {
          setUser(null);
          setIsChecking(false);
        }
      }
    }

    validateSession(!getStoredUser());

    let focusTimer = null;

    function handleWindowFocus() {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        validateSession(false);
      }, 400);
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearTimeout(focusTimer);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  if (isChecking) {
    return (
      <div className="route-loading" aria-live="polite">
        Carregando...
      </div>
    );
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
