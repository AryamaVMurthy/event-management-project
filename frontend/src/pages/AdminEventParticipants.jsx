// Admin Event Participants: Module level logic for the feature area.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import AdminNavbar from "../components/AdminNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// To Local: ToLocal. Converts local into a new representation. Inputs: value. Returns: a function result.
const toLocal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

const participantStatuses = [
  { label: "All statuses", value: "__all__" },
  { label: "Registered", value: "REGISTERED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Rejected", value: "REJECTED" },
];

const attendanceFilters = [
  { label: "All attendance", value: "__all__" },
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
];

// Admin Event Participants: Runs Admin event participants flow. Inputs: none. Returns: a function result.
export default function AdminEventParticipants() {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", attendance: "" });
  const [filesByRegistration, setFilesByRegistration] = useState({});
  const [loadingFilesFor, setLoadingFilesFor] = useState("");

  // Load: Loads the requested resources from API or cache. Inputs: nextFilters. Returns: a Promise with payload data.
  const load = async (nextFilters = filters) => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const [eventRes, participantsRes] = await Promise.all([
        api.get(`/events/organizer/events/${eventId}`),
        api.get(`/events/organizer/events/${eventId}/participants`, {
          params: nextFilters,
        }),
      ]);
      setEvent(eventRes.data?.event || null);
      setParticipants(participantsRes.data?.participants || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load event participants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Apply Filters: Applies filters to current state. Inputs: evt. Returns: a function result.
  const applyFilters = async (evt) => {
    evt.preventDefault();
    await load(filters);
  };

  // Load Files: Loads files linked to a registration or registration field. Inputs: registrationId. Returns: a function result.
  const loadFiles = async (registrationId) => {
    setLoadingFilesFor(registrationId);
    setError("");
    setMessage("");
    try {
      const response = await api.get(`/events/registrations/${registrationId}/files`);
      setFilesByRegistration((prev) => ({
        ...prev,
        [registrationId]: response.data?.files || [],
      }));
      if ((response.data?.files || []).length === 0) {
        setMessage("No uploaded files found for this registration");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load registration files");
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

  return (
    <div className="space-y-4">
      <AdminNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Admin Event Participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="outline">
            <Link to="/admin/clubs">Back to Manage Clubs/Organizers</Link>
          </Button>
          {event ? (
            <>
              <p>Event: {event.name}</p>
              <p>Type: {event.type}</p>
              <p>Status: {event.status}</p>
            </>
          ) : null}
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}
          {loading ? <p>Loading...</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="space-y-2">
            <Input
              placeholder="Search name or email"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value === "__all__" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {participantStatuses.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Attendance</Label>
              <Select
                value={filters.attendance || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    attendance: value === "__all__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attendanceFilters.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && participants.length === 0 ? (
            <p>No participants found.</p>
          ) : (
            participants.map((participant) => {
              const files = filesByRegistration[participant.registrationId];
              const isLoadingFiles = loadingFilesFor === participant.registrationId;
              return (
                <Card key={participant.registrationId}>
                  <CardContent className="space-y-1 pt-4">
                    <p>Name: {participant.participantName}</p>
                    <p>Email: {participant.email}</p>
                    <p>Registration Date: {toLocal(participant.registeredAt)}</p>
                    <p>Status: {participant.participationStatus}</p>
                    <p>Attendance: {participant.attended ? "Present" : "Absent"}</p>
                    <p>Team: {participant.teamName || "-"}</p>
                    <p>Ticket ID: {participant.ticketId || "-"}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => loadFiles(participant.registrationId)}
                      disabled={isLoadingFiles}
                    >
                      {isLoadingFiles ? "Loading Files..." : "View Uploaded Files"}
                    </Button>
                    {Array.isArray(files) ? (
                      files.length === 0 ? (
                        <p>No uploaded files.</p>
                      ) : (
                        files.map((file) => (
                          <div key={`${participant.registrationId}-${file.fieldId}`}>
                            <p>
                              {file.label}: {file.fileName || "-"}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                downloadFile(
                                  participant.registrationId,
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
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
