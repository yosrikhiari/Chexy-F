import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/log";
import { Loading } from "@/components/ui/loading";

const ProtectedRoute = () => {
  // Handle server-side rendering
  if (typeof window === "undefined") {
    return <Outlet />;
  }

  const { isAuthenticated, isLoading } = useAuth();
  
  logger.debug("ProtectedRoute - isAuthenticated:", isAuthenticated, "isLoading:", isLoading);
  
  // Show loading state while checking authentication
  if (isLoading) {
    return <Loading message="Checking authentication..." />;
  }
  
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
