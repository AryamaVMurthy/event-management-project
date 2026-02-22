import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import AdminNavbar from "../components/AdminNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const toLocal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function AdminOrganizerEvents() {
  const { organizerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [organizerName, setOrganizerName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!organizerId) return;
      setLoading(true);
      setError("");
      try {
        const [eventsRes, organizersRes] = await Promise.all([
          api.get("/events/organizer/events", { params: { organizerId } }),
          api.get("/admin/organizers", { params: { status: "ALL" } }),
        ]);
        setEvents(eventsRes.data?.events || []);
        const organizer = (organizersRes.data?.organizers || []).find(
          (item) => String(item._id) === String(organizerId)
        );
        setOrganizerName(organizer?.organizerName || "");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load organizer events");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizerId]);

  return (
    <div className="space-y-4">
      <AdminNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Organizer Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="outline">
            <Link to="/admin/clubs">Back to Manage Clubs/Organizers</Link>
          </Button>
          {organizerName ? <p>Organizer: {organizerName}</p> : null}
          {error ? <p>{error}</p> : null}
          {loading ? <p>Loading...</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && events.length === 0 ? (
            <p>No events found for this organizer.</p>
          ) : (
            events.map((event) => (
              <Card key={event._id}>
                <CardContent className="space-y-1 pt-4">
                  <p>Name: {event.name}</p>
                  <p>Type: {event.type}</p>
                  <p>Status: {event.status}</p>
                  <p>Start: {toLocal(event.startDate)}</p>
                  <Button asChild variant="outline">
                    <Link to={`/admin/events/${event._id}/participants`}>
                      View Participants & Files
                    </Link>
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
