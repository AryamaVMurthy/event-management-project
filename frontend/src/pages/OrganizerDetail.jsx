import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const toLocalDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function OrganizerDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizer, setOrganizer] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    const loadOrganizer = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/clubs/${id}/events`);
        setOrganizer(response.data?.organizer || null);
        setUpcomingEvents(response.data?.upcomingEvents || []);
        setPastEvents(response.data?.pastEvents || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load organizer details");
      } finally {
        setLoading(false);
      }
    };

    loadOrganizer();
  }, [id]);

  const visibleEvents = useMemo(
    () => (activeTab === "upcoming" ? upcomingEvents : pastEvents),
    [activeTab, upcomingEvents, pastEvents]
  );

  return (
    <div className="space-y-4">
      <ParticipantNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Organizer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="outline">
            <Link to="/clubs">Back to Clubs/Organizers</Link>
          </Button>
          {loading ? (
            <p>Loading organizer details...</p>
          ) : error ? (
            <p>{error}</p>
          ) : !organizer ? (
            <p>Organizer not found.</p>
          ) : (
            <>
              <p>Name: {organizer.organizerName || "-"}</p>
              <p>Category: {organizer.category?.name || "-"}</p>
              <p>Description: {organizer.description || "-"}</p>
              <p>Contact Email: {organizer.email || "-"}</p>
            </>
          )}
        </CardContent>
      </Card>

      {!loading && !error && organizer && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={activeTab === "upcoming" ? "default" : "outline"}
                  onClick={() => setActiveTab("upcoming")}
                >
                  Upcoming
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "past" ? "default" : "outline"}
                  onClick={() => setActiveTab("past")}
                >
                  Past
                </Button>
              </div>
              <Separator />
              {visibleEvents.length === 0 ? (
                <p>No {activeTab} events.</p>
              ) : (
                visibleEvents.map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <CardTitle>{event.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p>Type: {event.type}</p>
                      <p>Status: {event.status}</p>
                      <p>Eligibility: {event.eligibility}</p>
                      <p>Registration Deadline: {toLocalDateTime(event.registrationDeadline)}</p>
                      <p>Start: {toLocalDateTime(event.startDate)}</p>
                      <p>End: {toLocalDateTime(event.endDate)}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
