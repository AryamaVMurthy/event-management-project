// Clubs Organizers: Module level logic for the feature area.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Normalize Ids: Normalizes ids into the expected shape. Inputs: values. Returns: a function result.
const normalizeIds = (values = []) =>
  [...new Set(values.map((value) => String(value?._id || value)).filter(Boolean))];

// Clubs Organizers: Runs Clubs organizers flow. Inputs: none. Returns: a function result.
export default function ClubsOrganizers() {
  const [loading, setLoading] = useState(true);
  const [savingClubId, setSavingClubId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState([]);
  const [followedClubIds, setFollowedClubIds] = useState([]);

  useEffect(() => {
    // Load Page: Loads page from API or cache. Inputs: none. Returns: a function result.
    const loadPage = async () => {
      try {
        const [clubsResponse, meResponse] = await Promise.all([
          api.get("/clubs"),
          api.get("/user/me"),
        ]);

        const clubsData = clubsResponse.data?.clubs || [];
        const userData = meResponse.data?.user;
        const followed = normalizeIds(userData?.followedClubs || []);

        setClubs(clubsData);
        setFollowedClubIds(followed);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load clubs");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  // Toggle Follow Club: Toggles follow club in the view. Inputs: clubId. Returns: a function result.
  const toggleFollowClub = async (clubId) => {
    setSavingClubId(clubId);
    setError("");
    setMessage("");

    try {
      const isAlreadyFollowed = followedClubIds.includes(clubId);
      const nextFollowedClubIds = isAlreadyFollowed
        ? followedClubIds.filter((id) => id !== clubId)
        : [...followedClubIds, clubId];

      const response = await api.put("/user/followed-clubs", {
        followedClubs: nextFollowedClubIds,
      });

      const updated = normalizeIds(response.data?.user?.followedClubs || []);
      setFollowedClubIds(updated);
      setMessage(isAlreadyFollowed ? "Club unfollowed" : "Club followed");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update followed clubs");
    } finally {
      setSavingClubId("");
    }
  };

  const filteredClubs = clubs.filter((club) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    const organizerName = String(club.organizerName || "").toLowerCase();
    const categoryName = String(club.category?.name || "").toLowerCase();
    const description = String(club.description || "").toLowerCase();
    return (
      organizerName.includes(query) ||
      categoryName.includes(query) ||
      description.includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <ParticipantNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Clubs / Organizers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error && <p>{error}</p>}
          {message && <p>{message}</p>}
          <Label htmlFor="clubs-search">Search Clubs</Label>
          <Input
            id="clubs-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, category, description"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Clubs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p>Loading clubs...</p>
          ) : filteredClubs.length === 0 ? (
            <p>No clubs found.</p>
          ) : (
            filteredClubs.map((club) => {
              const clubId = String(club._id);
              const isFollowed = followedClubIds.includes(clubId);
              const isSaving = savingClubId === clubId;

              return (
                <Card key={clubId}>
                  <CardHeader>
                    <CardTitle>{club.organizerName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p>Category: {club.category?.name || "-"}</p>
                    <p>Description: {club.description || "-"}</p>
                    <p>Contact: {club.contactNumber || club.email || "-"}</p>
                    <Button asChild type="button" variant="outline">
                      <Link to={`/clubs/${clubId}`}>View Details</Link>
                    </Button>
                    <Button
                      type="button"
                      variant={isFollowed ? "default" : "outline"}
                      onClick={() => toggleFollowClub(clubId)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : isFollowed ? "Following" : "Follow"}
                    </Button>
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
