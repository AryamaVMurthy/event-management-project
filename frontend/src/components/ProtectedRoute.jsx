// Protected Route: Module level logic for the feature area.
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Protected Route: Runs Protected route flow. Inputs: {, allowedRoles. Returns: a function result.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  // Get Dashboard Route: Maps authenticated user role to the correct landing dashboard route. Inputs: role. Returns: a Promise with payload data.
  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return children;
}
