// Admin Dashboard: Module level logic for the feature area.
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AdminNavbar from "../components/AdminNavbar";

// Admin Dashboard: Runs Admin dashboard flow. Inputs: none. Returns: a function result.
export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      <AdminNavbar />
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Admin Section 11 Home</p>
          <Button asChild variant="outline">
            <Link to="/admin/clubs">Manage Clubs / Organizers</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/password-reset-requests">Password Reset Requests</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
