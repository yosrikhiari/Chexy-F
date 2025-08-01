import { Navigate, Outlet } from "react-router-dom";
import { JwtService } from "@/services/JwtService.ts";

const ProtectedRoute = () => {
  // Handle server-side rendering
  if (typeof window === "undefined") {
    return <Outlet />;
  }

  const token = JwtService.getToken();
  console.log("ProtectedRoute - Token:", token, "Expired:", JwtService.isTokenExpired(token));
  const isAuthenticated = !!token && !JwtService.isTokenExpired(token);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
