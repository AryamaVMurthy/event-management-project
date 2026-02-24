// Organizer Ongoing Events: Module level logic for the feature area.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// To Local: ToLocal. Converts local into a new representation. Inputs: value. Returns: a function result.
const toLocal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

// Organizer Ongoing Events: Runs Organizer ongoing events flow. Inputs: none. Returns: a function result.
export default function OrganizerOngoingEvents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Load: Loads the requested resources from API or cache. Inputs: none. Returns: a Promise with payload data.
    const load = async () => {
      try {
        const response = await api.get("/events/organizer/events", {
          params: { status: "ONGOING" },
        });
        setEvents(response.data?.events || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load ongoing events");
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
          <CardTitle>Ongoing Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p>{error}</p> : null}
          {loading ? (
            <p>Loading...</p>
          ) : events.length === 0 ? (
            <p>No ongoing events.</p>
          ) : (
            events.map((event) => (
              <Card key={event._id}>
                <CardContent className="space-y-1 pt-4">
                  <p>Name: {event.name}</p>
                  <p>Type: {event.type}</p>
                  <p>Start: {toLocal(event.startDate)}</p>
                  <Button asChild variant="outline">
                    <Link to={`/organizer/events/${event._id}`}>Manage</Link>
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
