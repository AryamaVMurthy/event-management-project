import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  if (loading) return <p>Loading...</p>;
  if (user) return <Navigate to={getDashboardRoute(user.role)} replace />;

  return children;
}
