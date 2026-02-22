import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const toLocal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function OrganizerEventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [event, setEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", attendance: "" });
  const [editForm, setEditForm] = useState({
    description: "",
    registrationDeadline: "",
    registrationLimit: "",
    tagsText: "",
  });
  const [filesByRegistration, setFilesByRegistration] = useState({});
  const [loadingFilesFor, setLoadingFilesFor] = useState("");

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const [eventRes, analyticsRes, participantsRes] = await Promise.all([
        api.get(`/events/organizer/events/${id}`),
        api.get(`/events/organizer/events/${id}/analytics`),
        api.get(`/events/organizer/events/${id}/participants`, { params: nextFilters }),
      ]);

      const loadedEvent = eventRes.data?.event || null;
      setEvent(loadedEvent);
      setAnalytics(analyticsRes.data?.analytics || null);
      setParticipants(participantsRes.data?.participants || []);
      setFilesByRegistration({});

      if (loadedEvent) {
        setEditForm({
          description: loadedEvent.description || "",
          registrationDeadline: loadedEvent.registrationDeadline
            ? new Date(loadedEvent.registrationDeadline).toISOString().slice(0, 16)
            : "",
          registrationLimit: loadedEvent.registrationLimit || "",
          tagsText: (loadedEvent.tags || []).join(", "),
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const applyParticipantFilters = async (evt) => {
    evt.preventDefault();
    await load(filters);
  };

  const lifecycleActions = useMemo(() => {
    if (!event) return [];
    if (event.status === "DRAFT") return [{ label: "Publish", endpoint: "publish" }];
    if (event.status === "PUBLISHED") return [{ label: "Start", endpoint: "start" }, { label: "Close", endpoint: "close" }];
    if (event.status === "ONGOING") return [{ label: "Close", endpoint: "close" }, { label: "Complete", endpoint: "complete" }];
    if (event.status === "CLOSED") return [{ label: "Complete", endpoint: "complete" }];
    return [];
  }, [event]);

  const runAction = async (endpoint) => {
    try {
      setError("");
      setMessage("");
      await api.post(`/events/${id}/${endpoint}`);
      setMessage("Status updated");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const saveEdits = async (evt) => {
    evt.preventDefault();
    try {
      setError("");
      setMessage("");
      await api.put(`/events/${id}`, {
        description: editForm.description,
        registrationDeadline: editForm.registrationDeadline || undefined,
        registrationLimit: editForm.registrationLimit ? Number(editForm.registrationLimit) : undefined,
        tags: editForm.tagsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setMessage("Event updated");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update event");
    }
  };

  const deleteDraftEvent = async () => {
    if (!event || event.status !== "DRAFT") return;
    const confirmed = window.confirm("Delete this draft event permanently?");
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await api.delete(`/events/${id}`);
      navigate("/organizer/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete draft event");
    }
  };

  const loadFiles = async (registrationId) => {
    setLoadingFilesFor(registrationId);
    setError("");
    setMessage("");
    try {
      const response = await api.get(`/events/registrations/${registrationId}/files`);
      const files = response.data?.files || [];
      setFilesByRegistration((prev) => ({
        ...prev,
        [registrationId]: files,
      }));
      if (files.length === 0) {
        setMessage("No uploaded files found for this registration");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load registration files");
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

  const updateAttendance = async (registrationId, attended) => {
    try {
      await api.patch(`/events/organizer/events/${id}/participants/${registrationId}/attendance`, {
        attended: !attended,
      });
      await load(filters);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update attendance");
    }
  };

  const exportCsvUrl = `${import.meta.env.VITE_API_URL}/events/organizer/events/${id}/participants/export`;

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

  return (
    <div className="space-y-4">
      <OrganizerNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Organizer Event Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="outline">
            <Link to="/organizer/dashboard">Back to Dashboard</Link>
          </Button>
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}
          {loading ? <p>Loading...</p> : null}
          {!loading && event ? (
            <>
              <p>Name: {event.name}</p>
              <p>Type: {event.type}</p>
              <p>Status: {event.status}</p>
              <p>Eligibility: {event.eligibility}</p>
              <p>Fee: Rs. {event.registrationFee}</p>
              <p>Registration Limit: {event.registrationLimit}</p>
              <p>Deadline: {toLocal(event.registrationDeadline)}</p>
              <p>Start: {toLocal(event.startDate)}</p>
              <p>End: {toLocal(event.endDate)}</p>
              <p>Description: {event.description}</p>
              {event.status === "DRAFT" ? (
                <Button type="button" variant="outline" onClick={deleteDraftEvent}>
                  Delete Draft
                </Button>
              ) : null}
              {lifecycleActions.map((action) => (
                <Button
                  key={action.endpoint}
                  type="button"
                  variant="outline"
                  onClick={() => runAction(action.endpoint)}
                >
                  {action.label}
                </Button>
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Allowed Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveEdits} className="space-y-3">
            <div>
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-deadline">Registration Deadline</Label>
              <Input
                id="edit-deadline"
                type="datetime-local"
                value={editForm.registrationDeadline}
                onChange={(e) => setEditForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-limit">Registration Limit</Label>
              <Input
                id="edit-limit"
                type="number"
                min="1"
                value={editForm.registrationLimit}
                onChange={(e) => setEditForm((prev) => ({ ...prev, registrationLimit: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-tags">Tags (comma separated)</Label>
              <Input
                id="edit-tags"
                value={editForm.tagsText}
                onChange={(e) => setEditForm((prev) => ({ ...prev, tagsText: e.target.value }))}
              />
            </div>
            <Button type="submit" variant="outline">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {!analytics ? (
            <p>No analytics</p>
          ) : (
            <>
              <p>Registrations: {analytics.registrations}</p>
              <p>Sales: {analytics.merchSales}</p>
              <p>Revenue: Rs. {analytics.revenue}</p>
              <p>Attendance: {analytics.attendance}</p>
              <p>Team Completion Count: {analytics.teamCompletionCount}</p>
              <p>Team Completion Rate: {analytics.teamCompletionRate}%</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={applyParticipantFilters} className="space-y-2">
            <Input
              placeholder="Search name or email"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <div>
              <Label>Participation Status</Label>
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
            <Button type="submit" variant="outline">Apply Participant Filters</Button>
            <Button asChild type="button" variant="outline">
              <a href={exportCsvUrl} target="_blank" rel="noreferrer">
                Export CSV
              </a>
            </Button>
          </form>

          {participants.length === 0 ? (
            <p>No participants found.</p>
          ) : (
            participants.map((participant) => (
              <Card key={participant.registrationId}>
                <CardContent className="space-y-1 pt-4">
                  <p>Name: {participant.participantName}</p>
                  <p>Email: {participant.email}</p>
                  <p>Registration Date: {toLocal(participant.registeredAt)}</p>
                  <p>Payment: Rs. {participant.paymentAmount}</p>
                  <p>Team: {participant.teamName || "-"}</p>
                  <p>Status: {participant.participationStatus}</p>
                  <p>Attendance: {participant.attended ? "Present" : "Absent"}</p>
                  <p>Ticket ID: {participant.ticketId || "-"}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadFiles(participant.registrationId)}
                    disabled={loadingFilesFor === participant.registrationId}
                  >
                    {loadingFilesFor === participant.registrationId
                      ? "Loading Files..."
                      : "View Uploaded Files"}
                  </Button>
                  {Array.isArray(filesByRegistration[participant.registrationId]) ? (
                    filesByRegistration[participant.registrationId].length === 0 ? (
                      <p>No uploaded files.</p>
                    ) : (
                      filesByRegistration[participant.registrationId].map((file) => (
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => updateAttendance(participant.registrationId, participant.attended)}
                  >
                    Mark {participant.attended ? "Absent" : "Present"}
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
