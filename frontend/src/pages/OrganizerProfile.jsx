// Organizer Profile: Module level logic for the feature area.
import { useEffect, useState } from "react";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Organizer Profile: Runs Organizer profile flow. Inputs: none. Returns: a function result.
export default function OrganizerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [resetReason, setResetReason] = useState("");

  const [form, setForm] = useState({
    email: "",
    organizerName: "",
    category: "",
    description: "",
    contactNumber: "",
    discordWebhookUrl: "",
  });

  useEffect(() => {
    // Load: Loads the requested resources from API or cache. Inputs: none. Returns: a Promise with payload data.
    const load = async () => {
      try {
        const [meRes, catRes, resetRes] = await Promise.all([
          api.get("/user/me"),
          api.get("/clubs/categories/all"),
          api.get("/user/password-reset-requests"),
        ]);

        const user = meRes.data?.user || {};
        setForm({
          email: user.email || "",
          organizerName: user.organizerName || "",
          category: user.category || "",
          description: user.description || "",
          contactNumber: user.contactNumber || "",
          discordWebhookUrl: user.discordWebhookUrl || "",
        });
        setCategories(catRes.data?.categories || []);
        setPasswordResetRequests(resetRes.data?.requests || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load organizer profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Save: Saves changes to the data store. Inputs: event. Returns: side effects and response to caller.
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.put("/user/profile", {
        organizerName: form.organizerName,
        category: form.category,
        description: form.description,
        contactNumber: form.contactNumber,
        discordWebhookUrl: form.discordWebhookUrl,
      });
      setMessage("Profile updated");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Create Reset Request: Creates reset request from input data. Inputs: event. Returns: side effects and response to caller.
  const createResetRequest = async (event) => {
    event.preventDefault();
    setRequestingReset(true);
    setError("");
    setMessage("");
    try {
      await api.post("/user/password-reset-requests", { reason: resetReason });
      setResetReason("");
      const resetRes = await api.get("/user/password-reset-requests");
      setPasswordResetRequests(resetRes.data?.requests || []);
      setMessage("Password reset request submitted");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit password reset request");
    } finally {
      setRequestingReset(false);
    }
  };

  return (
    <div className="space-y-4">
      <OrganizerNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Organizer Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}
          {loading ? (
            <p>Loading...</p>
          ) : (
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label htmlFor="org-email">Login Email (non-editable)</Label>
                <Input id="org-email" value={form.email} disabled />
              </div>
              <div>
                <Label htmlFor="org-name">Organizer Name</Label>
                <Input
                  id="org-name"
                  value={form.organizerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizerName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category || "__none__"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, category: value === "__none__" ? "" : value }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="org-desc">Description</Label>
                <Input
                  id="org-desc"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="org-contact">Contact Number</Label>
                <Input
                  id="org-contact"
                  value={form.contactNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="org-webhook">Discord Webhook URL</Label>
                <Input
                  id="org-webhook"
                  value={form.discordWebhookUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, discordWebhookUrl: e.target.value }))}
                />
              </div>
              <Button type="submit" variant="outline" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password Reset Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={createResetRequest} className="space-y-3">
            <div>
              <Label htmlFor="reset-reason">Reason</Label>
              <Input
                id="reset-reason"
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="Explain why password reset is needed"
              />
            </div>
            <Button type="submit" variant="outline" disabled={requestingReset}>
              {requestingReset ? "Submitting..." : "Request Password Reset"}
            </Button>
          </form>

          {passwordResetRequests.length === 0 ? (
            <p>No reset requests yet.</p>
          ) : (
            passwordResetRequests.map((request) => (
              <Card key={request._id}>
                <CardContent className="space-y-1 pt-4">
                  <p>Status: {request.status}</p>
                  <p>Reason: {request.reason}</p>
                  <p>Requested At: {new Date(request.requestedAt).toLocaleString()}</p>
                  <p>Reviewed At: {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "-"}</p>
                  <p>Admin Comment: {request.adminComment || "-"}</p>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
