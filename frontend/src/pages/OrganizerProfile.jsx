import { useEffect, useState } from "react";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OrganizerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    email: "",
    organizerName: "",
    category: "",
    description: "",
    contactNumber: "",
    discordWebhookUrl: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, catRes] = await Promise.all([
          api.get("/user/me"),
          api.get("/clubs/categories/all"),
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
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load organizer profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
    </div>
  );
}
