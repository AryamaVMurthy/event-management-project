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
  const [filesByRegistration, setFilesByRegistration] = useState({});
  const [loadingFilesFor, setLoadingFilesFor] = useState("");

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

  const loadFiles = async (registrationId) => {
    setLoadingFilesFor(registrationId);
    setError("");
    try {
      const response = await api.get(`/events/registrations/${registrationId}/files`);
      setFilesByRegistration((prev) => ({
        ...prev,
        [registrationId]: response.data?.files || [],
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load uploaded files");
    } finally {
      setLoadingFilesFor("");
    }
  };

  const downloadFile = async (registrationId, fieldId, fileName) => {
    setError("");
    try {
      const response = await api.get(`/events/files/${registrationId}/${fieldId}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download file");
    }
  };

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
        <Button
          type="button"
          variant="outline"
          onClick={() => loadFiles(record.registrationId)}
          disabled={loadingFilesFor === record.registrationId}
        >
          {loadingFilesFor === record.registrationId
            ? "Loading Files..."
            : "View Uploaded Files"}
        </Button>
        {Array.isArray(filesByRegistration[record.registrationId]) ? (
          filesByRegistration[record.registrationId].length === 0 ? (
            <p>No uploaded files.</p>
          ) : (
            filesByRegistration[record.registrationId].map((file) => (
              <div key={`${record.registrationId}-${file.fieldId}`}>
                <p>
                  {file.label}: {file.fileName || "-"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadFile(
                      record.registrationId,
                      file.fieldId,
                      file.fileName || `${file.fieldId}.bin`
                    )
                  }
                >
                  Download
                </Button>
              </div>
            ))
          )
        ) : null}
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
