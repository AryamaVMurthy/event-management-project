// Organizer Event Details: Module level logic for the feature area.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// To Local: ToLocal. Converts local into a new representation. Inputs: value. Returns: a function result.
const toLocal = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

// Organizer Event Details: Runs Organizer event details flow. Inputs: none. Returns: a function result.
export default function OrganizerEventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [event, setEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [merchOrders, setMerchOrders] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", attendance: "" });
  const [merchStatusFilter, setMerchStatusFilter] = useState("ALL");
  const [editForm, setEditForm] = useState({
    description: "",
    registrationDeadline: "",
    registrationLimit: "",
    tagsText: "",
  });
  const [filesByRegistration, setFilesByRegistration] = useState({});
  const [loadingFilesFor, setLoadingFilesFor] = useState("");
  const [loadingMerchOrders, setLoadingMerchOrders] = useState(false);
  const [downloadingPaymentProofFor, setDownloadingPaymentProofFor] = useState("");
  const [reviewCommentByOrder, setReviewCommentByOrder] = useState({});
  const [reviewingOrderFor, setReviewingOrderFor] = useState("");
  const [activePanel, setActivePanel] = useState("participants");
  const [scanPayloadText, setScanPayloadText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);
  const [loadingLiveSummary, setLoadingLiveSummary] = useState(false);
  const [manualOverrideForm, setManualOverrideForm] = useState({
    registrationId: "",
    attended: "true",
    reason: "",
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [decodingImage, setDecodingImage] = useState(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraPollTimerRef = useRef(null);

  // Load: Loads the requested resources from API or cache. Inputs: nextFilters. Returns: a Promise with payload data.
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
      if (loadedEvent?.type === "MERCHANDISE") {
        const ordersRes = await api.get(`/events/organizer/events/${id}/merch-orders`, {
          params: { paymentStatus: merchStatusFilter },
        });
        setMerchOrders(ordersRes.data?.orders || []);
      } else {
        setMerchOrders([]);
      }

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

  useEffect(() => {
    if (activePanel !== "scanner") return undefined;
    let cancelled = false;

    // Poll: Polls status data repeatedly until completion state changes. Inputs: none. Returns: a function result.
    const poll = async () => {
      if (cancelled) return;
      await fetchLiveAttendanceSummary();
    };

    poll();
    const timer = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, id]);

  useEffect(
    () => () => {
      stopCameraScanner();
    },
    []
  );

  // Apply Participant Filters: Applies participant filters to current state. Inputs: evt. Returns: a function result.
  const applyParticipantFilters = async (evt) => {
    evt.preventDefault();
    await load(filters);
  };

  // Load Merch Orders: Loads merchandise orders for the selected event and current status filter. Inputs: nextStatus. Returns: a function result.
  const loadMerchOrders = async (nextStatus = merchStatusFilter) => {
    if (!event || event.type !== "MERCHANDISE") {
      setMerchOrders([]);
      return;
    }

    setLoadingMerchOrders(true);
    setError("");
    try {
      const response = await api.get(`/events/organizer/events/${id}/merch-orders`, {
        params: { paymentStatus: nextStatus },
      });
      setMerchOrders(response.data?.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load merchandise orders");
    } finally {
      setLoadingMerchOrders(false);
    }
  };

  const lifecycleActions = useMemo(() => {
    if (!event) return [];
    if (event.status === "DRAFT") return [{ label: "Publish", endpoint: "publish" }];
    if (event.status === "PUBLISHED") return [{ label: "Start", endpoint: "start" }, { label: "Close", endpoint: "close" }];
    if (event.status === "ONGOING") return [{ label: "Close", endpoint: "close" }, { label: "Complete", endpoint: "complete" }];
    if (event.status === "CLOSED") return [{ label: "Complete", endpoint: "complete" }];
    return [];
  }, [event]);

  // Run Action: Runs action and wires outcomes. Inputs: endpoint. Returns: a function result.
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

  // Save Edits: Saves edits to the data store. Inputs: evt. Returns: side effects and response to caller.
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

  // Delete Draft Event: Deletes draft event from persistent storage. Inputs: none. Returns: side effects and response to caller.
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

  // Load Files: Loads files linked to a registration or registration field. Inputs: registrationId. Returns: a function result.
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

  // Download Payment Proof: Downloads payment proof media for review workflows. Inputs: registrationId, fileName. Returns: a function result.
  const downloadPaymentProof = async (registrationId, fileName) => {
    setDownloadingPaymentProofFor(registrationId);
    setError("");
    try {
      const response = await api.get(
        `/events/registrations/${registrationId}/payment-proof?download=true`,
        {
          responseType: "blob",
        }
      );
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || `payment-proof-${registrationId}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download payment proof");
    } finally {
      setDownloadingPaymentProofFor("");
    }
  };

  // Review Merch Order: Updates merchandise order review state and notes from admin workflow. Inputs: registrationId, status. Returns: a function result.
  const reviewMerchOrder = async (registrationId, status) => {
    setReviewingOrderFor(registrationId);
    setError("");
    setMessage("");
    try {
      const reviewComment = reviewCommentByOrder[registrationId] || "";
      const response = await api.patch(
        `/events/organizer/events/${id}/merch-orders/${registrationId}/review`,
        {
          status,
          reviewComment,
        }
      );
      setMessage(response.data?.message || "Order reviewed");
      await load(filters);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review merchandise order");
    } finally {
      setReviewingOrderFor("");
    }
  };

  // Fetch Live Attendance Summary: Pulls and normalizes live attendance metrics. Inputs: none. Returns: a function result.
  const fetchLiveAttendanceSummary = async () => {
    if (!event) return;
    setLoadingLiveSummary(true);
    try {
      const response = await api.get(`/events/organizer/events/${id}/attendance/live`);
      setLiveSummary(response.data?.summary || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load live attendance summary");
    } finally {
      setLoadingLiveSummary(false);
    }
  };

  // Submit Scan Payload: Submits scan payload to backend services. Inputs: rawPayload. Returns: side effects and response to caller.
  const submitScanPayload = async (rawPayload = scanPayloadText) => {
    const payloadText = String(rawPayload || "").trim();
    if (!payloadText) {
      setError("Decoded QR payload is required");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError("Decoded QR payload must be valid JSON");
      return;
    }

    setScanning(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/events/organizer/events/${id}/attendance/scan`, {
        qrPayload: payload,
      });
      setMessage(response.data?.message || "Attendance scanned");
      await load(filters);
      await fetchLiveAttendanceSummary();
    } catch (err) {
      setError(err.response?.data?.message || "QR scan failed");
    } finally {
      setScanning(false);
    }
  };

  // Decode Qr From Image: Decodes and validates QR content extracted from uploaded image input. Inputs: file. Returns: a function result.
  const decodeQrFromImage = async (file) => {
    if (!file) {
      setError("Select an image to decode QR");
      return;
    }
    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setError("BarcodeDetector API is not supported in this browser");
      return;
    }

    setDecodingImage(true);
    setError("");
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const results = await detector.detect(bitmap);
      if (!results || results.length === 0 || !results[0].rawValue) {
        setError("No QR code detected in selected image");
        return;
      }
      setScanPayloadText(results[0].rawValue);
      setMessage("QR payload decoded from image");
    } catch (err) {
      setError(err.message || "Failed to decode QR from image");
    } finally {
      setDecodingImage(false);
    }
  };

  // Stop Camera Scanner: Stops camera scanner and releases stream resources. Inputs: none. Returns: a function result.
  const stopCameraScanner = () => {
    if (cameraPollTimerRef.current) {
      clearInterval(cameraPollTimerRef.current);
      cameraPollTimerRef.current = null;
    }
    if (cameraStreamRef.current) {
      for (const track of cameraStreamRef.current.getTracks()) {
        track.stop();
      }
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start Camera Scanner: Starts camera capture stream for scan operations. Inputs: none. Returns: a function result.
  const startCameraScanner = async () => {
    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setError("BarcodeDetector API is not supported in this browser");
      return;
    }

    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setCameraActive(true);

      cameraPollTimerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const results = await detector.detect(videoRef.current);
          if (results && results.length > 0 && results[0].rawValue) {
            const rawValue = results[0].rawValue;
            setScanPayloadText(rawValue);
            stopCameraScanner();
            await submitScanPayload(rawValue);
          }
        } catch (err) {
          setError(err.message || "Camera QR scan failed");
          stopCameraScanner();
        }
      }, 800);
    } catch (err) {
      setError(err.message || "Unable to start camera scanner");
      stopCameraScanner();
    }
  };

  // Submit Manual Override: Submits a manual attendance override decision from scanner view. Inputs: eventObj. Returns: side effects and response to caller.
  const submitManualOverride = async (eventObj) => {
    eventObj.preventDefault();
    const registrationId = manualOverrideForm.registrationId.trim();
    const reason = manualOverrideForm.reason.trim();

    if (!registrationId) {
      setError("registrationId is required for manual override");
      return;
    }
    if (!reason) {
      setError("Reason is required for manual override");
      return;
    }

    setError("");
    setMessage("");
    try {
      const response = await api.post(`/events/organizer/events/${id}/attendance/override`, {
        registrationId,
        attended: manualOverrideForm.attended === "true",
        reason,
      });
      setMessage(response.data?.message || "Manual override applied");
      await load(filters);
      await fetchLiveAttendanceSummary();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to apply manual override");
    }
  };

  // Update Attendance: Updates attendance based on input. Inputs: registrationId, attended. Returns: side effects and response to caller.
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

  const merchPaymentStatuses = [
    { label: "All payment statuses", value: "ALL" },
    { label: "Payment Pending", value: "PAYMENT_PENDING" },
    { label: "Pending Approval", value: "PENDING_APPROVAL" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
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
          <CardTitle>Attendance Tools</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            type="button"
            variant={activePanel === "participants" ? "default" : "outline"}
            onClick={() => setActivePanel("participants")}
          >
            Participants Table
          </Button>
          <Button
            type="button"
            variant={activePanel === "scanner" ? "default" : "outline"}
            onClick={() => setActivePanel("scanner")}
          >
            QR Scanner + Live
          </Button>
        </CardContent>
      </Card>

      {event?.type === "MERCHANDISE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Merchandise Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Payment Status Filter</Label>
              <Select
                value={merchStatusFilter}
                onValueChange={(value) => setMerchStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {merchPaymentStatuses.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => loadMerchOrders(merchStatusFilter)}
                disabled={loadingMerchOrders}
              >
                {loadingMerchOrders ? "Loading..." : "Apply Order Filter"}
              </Button>
            </div>

            {merchOrders.length === 0 ? (
              <p>No merchandise orders found.</p>
            ) : (
              merchOrders.map((order) => (
                <Card key={order.registrationId}>
                  <CardContent className="space-y-1 pt-4">
                    <p>Name: {order.participant?.name || "-"}</p>
                    <p>Email: {order.participant?.email || "-"}</p>
                    <p>Status: {order.paymentStatus}</p>
                    <p>Quantity: {order.quantity}</p>
                    <p>Total Amount: Rs. {order.totalAmount}</p>
                    <p>Item ID: {order.itemId || "-"}</p>
                    <p>Variant ID: {order.variantId || "-"}</p>
                    <p>Proof Uploaded At: {toLocal(order.paymentProof?.uploadedAt)}</p>
                    <p>Review Comment: {order.reviewComment || "-"}</p>
                    {order.paymentStatus === "PENDING_APPROVAL" ? (
                      <Input
                        value={reviewCommentByOrder[order.registrationId] || ""}
                        placeholder="Optional review comment"
                        onChange={(event) =>
                          setReviewCommentByOrder((prev) => ({
                            ...prev,
                            [order.registrationId]: event.target.value,
                          }))
                        }
                      />
                    ) : null}
                    {order.paymentProof ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          downloadPaymentProof(
                            order.registrationId,
                            order.paymentProof?.fileName || "payment-proof"
                          )
                        }
                        disabled={downloadingPaymentProofFor === order.registrationId}
                      >
                        {downloadingPaymentProofFor === order.registrationId
                          ? "Downloading..."
                          : "Download Payment Proof"}
                      </Button>
                    ) : (
                      <p>No payment proof uploaded.</p>
                    )}
                    {order.paymentStatus === "PENDING_APPROVAL" ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => reviewMerchOrder(order.registrationId, "APPROVED")}
                          disabled={reviewingOrderFor === order.registrationId}
                        >
                          {reviewingOrderFor === order.registrationId ? "Saving..." : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => reviewMerchOrder(order.registrationId, "REJECTED")}
                          disabled={reviewingOrderFor === order.registrationId}
                        >
                          {reviewingOrderFor === order.registrationId ? "Saving..." : "Reject"}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {activePanel === "scanner" ? (
        <Card>
          <CardHeader>
            <CardTitle>QR Scanner + Manual Override</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decoded-qr-payload">Decoded QR Payload (JSON)</Label>
              <Input
                id="decoded-qr-payload"
                value={scanPayloadText}
                onChange={(eventObj) => setScanPayloadText(eventObj.target.value)}
                placeholder='{"ticketId":"...","registrationId":"...","participantId":"...","eventId":"..."}'
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitScanPayload(scanPayloadText)}
                  disabled={scanning}
                >
                  {scanning ? "Scanning..." : "Scan Decoded Payload"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCameraScanner}
                  disabled={cameraActive}
                >
                  Start Camera Decode
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCameraScanner}
                  disabled={!cameraActive}
                >
                  Stop Camera
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-image-upload">Decode From Image</Label>
              <Input
                id="qr-image-upload"
                type="file"
                accept="image/*"
                onChange={(eventObj) =>
                  decodeQrFromImage(eventObj.target.files?.[0] || null)
                }
              />
              <p>{decodingImage ? "Decoding image..." : "Upload an image containing QR code."}</p>
            </div>

            <video ref={videoRef} className={cameraActive ? "w-full max-w-md" : "hidden"} autoPlay muted />

            <form onSubmit={submitManualOverride} className="space-y-2">
              <Label>Manual Override</Label>
              <Select
                value={manualOverrideForm.registrationId || "__none__"}
                onValueChange={(value) =>
                  setManualOverrideForm((prev) => ({
                    ...prev,
                    registrationId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select registration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select registration</SelectItem>
                  {participants.map((participant) => (
                    <SelectItem
                      key={participant.registrationId}
                      value={participant.registrationId}
                    >
                      {participant.participantName} ({participant.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={manualOverrideForm.attended}
                onValueChange={(value) =>
                  setManualOverrideForm((prev) => ({ ...prev, attended: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Mark Present</SelectItem>
                  <SelectItem value="false">Mark Absent</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={manualOverrideForm.reason}
                placeholder="Reason for manual override"
                onChange={(eventObj) =>
                  setManualOverrideForm((prev) => ({
                    ...prev,
                    reason: eventObj.target.value,
                  }))
                }
              />
              <Button type="submit" variant="outline">
                Submit Manual Override
              </Button>
            </form>

            <div className="space-y-2">
              <p>
                {loadingLiveSummary
                  ? "Refreshing live summary..."
                  : "Live summary auto-refreshes every 5 seconds."}
              </p>
              <p>Total Registrations: {liveSummary?.totalRegistrations ?? "-"}</p>
              <p>Attended: {liveSummary?.attendedCount ?? "-"}</p>
              <p>Unattended: {liveSummary?.unattendedCount ?? "-"}</p>
              <div className="space-y-1">
                <Label>Recent Audit Logs</Label>
                {Array.isArray(liveSummary?.recentLogs) && liveSummary.recentLogs.length > 0 ? (
                  liveSummary.recentLogs.map((log) => (
                    <p key={log.id}>
                      {toLocal(log.occurredAt)} | {log.action} | {log.reason || "-"}
                    </p>
                  ))
                ) : (
                  <p>No audit logs yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activePanel === "participants" ? (
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
      ) : null}
    </div>
  );
}
