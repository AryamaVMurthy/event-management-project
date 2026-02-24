// Organizer Dashboard: Module level logic for the feature area.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Organizer Dashboard: Runs Organizer dashboard flow. Inputs: none. Returns: a function result.
export default function OrganizerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [completedSummary, setCompletedSummary] = useState({
    registrations: 0,
    sales: 0,
    revenue: 0,
    attendance: 0,
  });

  useEffect(() => {
    // Load: Loads the requested resources from API or cache. Inputs: none. Returns: a Promise with payload data.
    const load = async () => {
      try {
        const response = await api.get("/events/organizer/events", {
          params: { includeCompletedSummary: "true" },
        });
        setEvents(response.data?.events || []);
        setCompletedSummary(
          response.data?.completedSummary || {
            registrations: 0,
            sales: 0,
            revenue: 0,
            attendance: 0,
          }
        );
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load organizer dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-4">
      <OrganizerNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Organizer Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p>{error}</p> : null}
          <p>Completed Event Summary</p>
          <p>Registrations: {completedSummary.registrations}</p>
          <p>Sales: {completedSummary.sales}</p>
          <p>Revenue: Rs. {completedSummary.revenue}</p>
          <p>Attendance: {completedSummary.attendance}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p>No events created yet.</p>
          ) : (
            events.map((event) => (
              <Card key={event._id}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p>Type: {event.type}</p>
                  <p>Status: {event.status}</p>
                  <Button asChild variant="outline">
                    <Link to={`/organizer/events/${event._id}`}>Manage Event</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
