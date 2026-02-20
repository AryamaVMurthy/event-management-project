import { useEffect, useState } from "react";
import api from "../lib/api";
import AdminNavbar from "../components/AdminNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminManageClubs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  const [categories, setCategories] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [organizerForm, setOrganizerForm] = useState({
    organizerName: "",
    category: "",
    description: "",
    contactNumber: "",
  });

  const loadData = async (nextStatus = statusFilter, nextQuery = searchQuery) => {
    setLoading(true);
    try {
      const [categoryRes, organizerRes] = await Promise.all([
        api.get("/clubs/categories/all"),
        api.get("/admin/organizers", {
          params: { status: nextStatus, q: nextQuery },
        }),
      ]);
      setCategories(categoryRes.data?.categories || []);
      setOrganizers(organizerRes.data?.organizers || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin organizer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData("ALL", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCategory = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/clubs/categories", categoryForm);
      setCategoryForm({ name: "", description: "" });
      setMessage("Category created");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create category");
    }
  };

  const createOrganizer = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setGeneratedCredentials(null);
    try {
      const response = await api.post("/clubs", organizerForm);
      setGeneratedCredentials(response.data?.generatedCredentials || null);
      setOrganizerForm({
        organizerName: "",
        category: "",
        description: "",
        contactNumber: "",
      });
      setMessage("Organizer account created");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create organizer");
    }
  };

  const updateStatus = async (organizerId, accountStatus) => {
    setError("");
    setMessage("");
    try {
      await api.patch(`/admin/organizers/${organizerId}/status`, { accountStatus });
      setMessage(`Organizer moved to ${accountStatus}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update organizer status");
    }
  };

  const deleteOrganizer = async (organizerId) => {
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/organizers/${organizerId}`);
      setMessage("Organizer deleted permanently");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete organizer");
    }
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadData(statusFilter, searchQuery);
  };

  return (
    <div className="space-y-4">
      <AdminNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Manage Clubs / Organizers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}
          {loading ? <p>Loading...</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createCategory} className="space-y-3">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <Button type="submit" variant="outline">
              Create Category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Organizer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createOrganizer} className="space-y-3">
            <div>
              <Label htmlFor="organizer-name">Organizer Name</Label>
              <Input
                id="organizer-name"
                value={organizerForm.organizerName}
                onChange={(e) =>
                  setOrganizerForm((prev) => ({ ...prev, organizerName: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={organizerForm.category || "__none__"}
                onValueChange={(value) =>
                  setOrganizerForm((prev) => ({
                    ...prev,
                    category: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="organizer-description">Description</Label>
              <Input
                id="organizer-description"
                value={organizerForm.description}
                onChange={(e) =>
                  setOrganizerForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="organizer-contact-number">Contact Number</Label>
              <Input
                id="organizer-contact-number"
                value={organizerForm.contactNumber}
                onChange={(e) =>
                  setOrganizerForm((prev) => ({ ...prev, contactNumber: e.target.value }))
                }
              />
            </div>
            <Button type="submit" variant="outline">
              Create Organizer
            </Button>
          </form>
        </CardContent>
      </Card>

      {generatedCredentials ? (
        <Card>
          <CardHeader>
            <CardTitle>Generated Credentials (showing once)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Email: {generatedCredentials.email}</p>
            <p>Password: {generatedCredentials.password}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organizer Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={applyFilters} className="space-y-2">
            <Input
              placeholder="Search by organizer name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="DISABLED">DISABLED</SelectItem>
                <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Apply Filters
            </Button>
          </form>

          {organizers.length === 0 ? (
            <p>No organizers found.</p>
          ) : (
            organizers.map((organizer) => (
              <Card key={organizer._id}>
                <CardContent className="space-y-1 pt-4">
                  <p>Name: {organizer.organizerName}</p>
                  <p>Email: {organizer.email}</p>
                  <p>Status: {organizer.accountStatus}</p>
                  <p>Category: {organizer.category?.name || "-"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateStatus(organizer._id, "DISABLED")}
                    >
                      Disable
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateStatus(organizer._id, "ARCHIVED")}
                    >
                      Archive
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateStatus(organizer._id, "ACTIVE")}
                    >
                      Activate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => deleteOrganizer(organizer._id)}
                    >
                      Delete Permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
