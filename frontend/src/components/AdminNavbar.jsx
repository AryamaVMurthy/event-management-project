import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Button } from "@/components/ui/button";

const menu = [
  { label: "Dashboard", to: "/admin/dashboard" },
  { label: "Manage Clubs/Organizers", to: "/admin/clubs" },
  { label: "Password Reset Requests", to: "/admin/password-reset-requests" },
];

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-wrap gap-2">
      {menu.map((item) => (
        <Button
          key={item.to}
          asChild
          variant={location.pathname === item.to ? "default" : "outline"}
        >
          <Link to={item.to}>{item.label}</Link>
        </Button>
      ))}
      <Button type="button" variant="outline" onClick={handleLogout}>
        Logout
      </Button>
    </div>
  );
}
