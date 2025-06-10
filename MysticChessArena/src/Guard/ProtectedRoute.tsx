// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";

const getCookie = (name: string): string | null => {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }
  return null;
};

const ProtectedRoute = () => {
  // For server-side rendering, assume authenticated (similar to Angular's isPlatformBrowser check)
  if (typeof window === "undefined") {
    return <Outlet />;
  }

  const token = getCookie("authToken");
  const isAuthenticated = !!token; // True if token exists

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
