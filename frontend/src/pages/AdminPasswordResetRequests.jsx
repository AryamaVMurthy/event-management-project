import { useEffect, useState } from "react";
import api from "../lib/api";
import AdminNavbar from "../components/AdminNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPasswordResetRequests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [organizers, setOrganizers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  const [createForm, setCreateForm] = useState({
    organizerId: "",
    reason: "",
  });
  const [reviewComment, setReviewComment] = useState("");

  const loadData = async (status = statusFilter) => {
    setLoading(true);
    try {
      const [organizersRes, requestsRes] = await Promise.all([
        api.get("/admin/organizers", { params: { status: "ALL" } }),
        api.get("/admin/password-reset-requests", { params: { status } }),
      ]);
      setOrganizers(organizersRes.data?.organizers || []);
      setRequests(requestsRes.data?.requests || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reset requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRequest = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setGeneratedCredentials(null);
    try {
      await api.post("/admin/password-reset-requests", createForm);
      setCreateForm({ organizerId: "", reason: "" });
      setMessage("Password reset request created");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create reset request");
    }
  };

  const reviewRequest = async (requestId, status) => {
    setError("");
    setMessage("");
    setGeneratedCredentials(null);
    try {
      const response = await api.patch(`/admin/password-reset-requests/${requestId}/review`, {
        status,
        adminComment: reviewComment || undefined,
      });
      setMessage(response.data?.message || "Request reviewed");
      setReviewComment("");
      setGeneratedCredentials(response.data?.generatedCredentials || null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review request");
    }
  };

  const applyFilter = async (event) => {
    event.preventDefault();
    await loadData(statusFilter);
  };

  return (
    <div className="space-y-4">
      <AdminNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Password Reset Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}
          {loading ? <p>Loading...</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Reset Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRequest} className="space-y-3">
            <div>
              <Label>Organizer</Label>
              <Select
                value={createForm.organizerId || "__none__"}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    organizerId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organizer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select organizer</SelectItem>
                  {organizers.map((organizer) => (
                    <SelectItem key={organizer._id} value={organizer._id}>
                      {organizer.organizerName} ({organizer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reset-reason">Reason</Label>
              <Input
                id="reset-reason"
                value={createForm.reason}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
            <Button type="submit" variant="outline">
              Create Request
            </Button>
          </form>
        </CardContent>
      </Card>

      {generatedCredentials ? (
        <Card>
          <CardHeader>
            <CardTitle>Generated Temp Credentials (show once)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Email: {generatedCredentials.email}</p>
            <p>Password: {generatedCredentials.password}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Request List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={applyFilter} className="space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Admin comment for next review action"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
            <Button type="submit" variant="outline">
              Apply Status Filter
            </Button>
          </form>

          {requests.length === 0 ? (
            <p>No reset requests found.</p>
          ) : (
            requests.map((request) => (
              <Card key={request._id}>
                <CardContent className="space-y-1 pt-4">
                  <p>Organizer: {request.organizerId?.organizerName || "-"}</p>
                  <p>Email: {request.organizerId?.email || "-"}</p>
                  <p>Status: {request.status}</p>
                  <p>Reason: {request.reason}</p>
                  <p>Requested At: {new Date(request.requestedAt).toLocaleString()}</p>
                  <p>Admin Comment: {request.adminComment || "-"}</p>
                  {request.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => reviewRequest(request._id, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => reviewRequest(request._id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
