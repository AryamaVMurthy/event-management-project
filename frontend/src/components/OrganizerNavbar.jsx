// Organizer Navbar: Module level logic for the feature area.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/useAuth";

const navItems = [
  { label: "Dashboard", to: "/organizer/dashboard" },
  { label: "Create Event", to: "/organizer/events/new" },
  { label: "Profile", to: "/organizer/profile" },
  { label: "Ongoing Events", to: "/organizer/events/ongoing" },
];

// Organizer Navbar: Runs Organizer navbar flow. Inputs: none. Returns: a function result.
export default function OrganizerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Handle Logout: Handles logout in the UI flow. Inputs: none. Returns: side effects and response to caller.
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
