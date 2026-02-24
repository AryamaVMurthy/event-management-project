// Public Only Route: Module level logic for the feature area.
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Public Only Route: Runs Public only route flow. Inputs: {. Returns: a function result.
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  // Get Dashboard Route: Maps authenticated user role to the correct landing dashboard route. Inputs: role. Returns: a Promise with payload data.
  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  if (loading) return <p>Loading...</p>;
  if (user) return <Navigate to={getDashboardRoute(user.role)} replace />;

  return children;
}
