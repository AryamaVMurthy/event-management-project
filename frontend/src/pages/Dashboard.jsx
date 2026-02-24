// Dashboard: Module level logic for the feature area.
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
import { Input } from "@/components/ui/input";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";

// Dashboard: Runs Dashboard flow. Inputs: none. Returns: a function result.
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
  const [calendarLinksByRegistration, setCalendarLinksByRegistration] = useState({});
  const [loadingCalendarLinksFor, setLoadingCalendarLinksFor] = useState("");
  const [downloadingCalendarFor, setDownloadingCalendarFor] = useState("");
  const [selectedRegistrations, setSelectedRegistrations] = useState({});
  const [batchReminderMinutes, setBatchReminderMinutes] = useState("30");
  const [downloadingBatchCalendar, setDownloadingBatchCalendar] = useState(false);

  useEffect(() => {
    // Load My Events: Loads current and historical registrations for a participant dashboard. Inputs: none. Returns: a function result.
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

  // Get Dashboard Route: Maps authenticated user role to the correct landing dashboard route. Inputs: role. Returns: a Promise with payload data.
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

  // Load Files: Loads files linked to a registration or registration field. Inputs: registrationId. Returns: a function result.
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

  // Download File: Downloads and prompts a file attachment for a given registration context. Inputs: registrationId, fieldId, fileName. Returns: a function result.
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

  // Download Calendar Ics: Downloads registration-based ICS file through browser blob flow. Inputs: registrationId, eventName. Returns: a function result.
  const downloadCalendarIcs = async (registrationId, eventName) => {
    setDownloadingCalendarFor(registrationId);
    setError("");
    try {
      const response = await api.get(`/calendar/registrations/${registrationId}.ics`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      const safeName = (eventName || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      link.download = `${safeName || "event"}-${registrationId}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download calendar file");
    } finally {
      setDownloadingCalendarFor("");
    }
  };

  // Toggle Calendar Selection: Toggles selected registrations for batch calendar actions. Inputs: record. Returns: a function result.
  const toggleCalendarSelection = (record) => {
    setSelectedRegistrations((prev) => {
      const next = { ...prev };
      if (next[record.registrationId]) {
        delete next[record.registrationId];
      } else {
        next[record.registrationId] = {
          registrationId: record.registrationId,
          eventName: record.eventName,
        };
      }
      return next;
    });
  };

  // Clear Calendar Selection: Clears accumulated registration selections. Inputs: none. Returns: a function result.
  const clearCalendarSelection = () => {
    setSelectedRegistrations({});
  };

  // Download Batch Calendar Ics: Builds a combined ICS export across multiple registrations. Inputs: none. Returns: a function result.
  const downloadBatchCalendarIcs = async () => {
    const registrationIds = Object.keys(selectedRegistrations);
    if (registrationIds.length === 0) {
      setError("Select at least one registration to export batch calendar");
      return;
    }

    setDownloadingBatchCalendar(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("registrationIds", registrationIds.join(","));
      if (batchReminderMinutes.trim()) {
        params.set("reminderMinutes", batchReminderMinutes.trim());
      }

      const response = await api.get(`/calendar/my-events.ics?${params.toString()}`, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "my-events.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download batch calendar file");
    } finally {
      setDownloadingBatchCalendar(false);
    }
  };

  // Load Calendar Links: Fetches prebuilt links for adding registration events to calendars. Inputs: registrationId. Returns: a function result.
  const loadCalendarLinks = async (registrationId) => {
    setLoadingCalendarLinksFor(registrationId);
    setError("");
    try {
      const response = await api.get(`/calendar/registrations/${registrationId}/links`);
      setCalendarLinksByRegistration((prev) => ({
        ...prev,
        [registrationId]: response.data?.links || null,
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load calendar links");
    } finally {
      setLoadingCalendarLinksFor("");
    }
  };

  // Render Record: Renders record as markup. Inputs: record. Returns: a function result.
  const renderRecord = (record) => (
    <Card key={record.registrationId}>
      <CardHeader>
        <CardTitle>{record.eventName}</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(selectedRegistrations[record.registrationId])}
            onChange={() => toggleCalendarSelection(record)}
          />
          Add to batch calendar export
        </label>
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
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadCalendarIcs(record.registrationId, record.eventName)}
            disabled={downloadingCalendarFor === record.registrationId}
          >
            {downloadingCalendarFor === record.registrationId
              ? "Downloading ICS..."
              : "Download Calendar ICS"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => loadCalendarLinks(record.registrationId)}
            disabled={loadingCalendarLinksFor === record.registrationId}
          >
            {loadingCalendarLinksFor === record.registrationId
              ? "Loading Links..."
              : "Show Calendar Links"}
          </Button>
        </div>
        {calendarLinksByRegistration[record.registrationId] ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <a
                href={calendarLinksByRegistration[record.registrationId].google}
                target="_blank"
                rel="noreferrer"
              >
                Open Google Calendar
              </a>
            </Button>
            <Button type="button" variant="outline" asChild>
              <a
                href={calendarLinksByRegistration[record.registrationId].outlook}
                target="_blank"
                rel="noreferrer"
              >
                Open Outlook Calendar
              </a>
            </Button>
          </div>
        ) : null}
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
          <CardTitle>Batch Calendar Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Selected registrations: {Object.keys(selectedRegistrations).length}</p>
          <div className="flex gap-2">
            <Input
              value={batchReminderMinutes}
              onChange={(event) => setBatchReminderMinutes(event.target.value)}
              placeholder="Reminder minutes (default 30)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={downloadBatchCalendarIcs}
              disabled={downloadingBatchCalendar}
            >
              {downloadingBatchCalendar ? "Downloading..." : "Export Selected ICS"}
            </Button>
            <Button type="button" variant="outline" onClick={clearCalendarSelection}>
              Clear Selection
            </Button>
          </div>
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
