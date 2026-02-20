import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Browse Events", to: "/events" },
  { label: "Clubs/Organizers", to: "/clubs" },
  { label: "Profile", to: "/profile" },
];

export default function ParticipantNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant Menu</CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
        {navItems.map((item) => (
          <Button key={item.to} asChild variant={pathname === item.to ? "default" : "outline"}>
            <Link to={item.to}>{item.label}</Link>
          </Button>
        ))}
        <Separator orientation="vertical" style={{ height: "24px" }} />
        <Button type="button" variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </CardContent>
    </Card>
  );
}
