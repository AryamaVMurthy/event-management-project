import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/useAuth";

const navItems = [
  { label: "Dashboard", to: "/organizer/dashboard" },
  { label: "Create Event", to: "/organizer/events/new" },
  { label: "Profile", to: "/organizer/profile" },
  { label: "Ongoing Events", to: "/organizer/events/ongoing" },
];

export default function OrganizerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-wrap gap-2">
      {navItems.map((item) => (
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
