import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { Link, Navigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";

export default function Dashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [history, setHistory] = useState({
    normal: [],
    merchandise: [],
    completed: [],
    cancelledRejected: [],
  });
  const [activeTab, setActiveTab] = useState("normal");

  useEffect(() => {
    const loadMyEvents = async () => {
      try {
        const response = await api.get("/user/my-events");
        setUpcomingEvents(response.data?.upcomingEvents || []);
        setHistory(
          response.data?.history || {
            normal: [],
            merchandise: [],
            completed: [],
            cancelledRejected: [],
          }
        );
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadMyEvents();
  }, []);

  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  const isParticipant = user?.role === "IIIT_PARTICIPANT" || user?.role === "NON_IIIT_PARTICIPANT";
  if (user && !isParticipant) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  const tabLabels = {
    normal: "Normal",
    merchandise: "Merchandise",
    completed: "Completed",
    cancelledRejected: "Cancelled/Rejected",
  };

  const activeHistoryRows = history?.[activeTab] || [];

  const renderRecord = (record) => (
    <Card key={record.registrationId}>
      <CardHeader>
        <CardTitle>{record.eventName}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Type: {record.eventType || "-"}</p>
        <p>Organizer: {record.organizerName || "-"}</p>
        <p>Status: {record.participationStatus || "-"}</p>
        <p>Team Name: {record.teamName || "-"}</p>
        <p>
          Schedule: {record.schedule?.startDate ? new Date(record.schedule.startDate).toLocaleString() : "-"}
        </p>
        <p>
          Ticket ID:{" "}
          {record.ticketId ? (
            <Link to={`/tickets/${record.ticketId}`}>
              {record.ticketId}
            </Link>
          ) : (
            "-"
          )}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <ParticipantNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Welcome, {user?.firstName}!</p>
          <p>Email: {user?.email}</p>
          <p>Role: {user?.role}</p>
          {error && <p>{error}</p>}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading upcoming events...</p>
          ) : upcomingEvents.length === 0 ? (
            <p>No upcoming registered events.</p>
          ) : (
            upcomingEvents.map((record) => renderRecord(record))
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Participation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            {Object.keys(tabLabels).map((tab) => (
              <Button
                key={tab}
                type="button"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabels[tab]}
              </Button>
            ))}
          </div>
          <Separator />
          {loading ? (
            <p>Loading history...</p>
          ) : activeHistoryRows.length === 0 ? (
            <p>No records in {tabLabels[activeTab]}.</p>
          ) : (
            activeHistoryRows.map((record) => renderRecord(record))
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/profile">Go to Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
