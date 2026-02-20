import { useEffect, useState } from "react";
import api from "../lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ParticipantNavbar from "../components/ParticipantNavbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [savingClubs, setSavingClubs] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [allInterests, setAllInterests] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    contactNumber: "",
    collegeOrgName: "",
    batch: "",
    email: "",
    role: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profileResponse, interestsResponse, clubsResponse] = await Promise.all([
          api.get("/user/me"),
          api.get("/interests"),
          api.get("/clubs"),
        ]);
        const user = profileResponse.data?.user;
        const interests = interestsResponse.data?.interests || [];
        const clubs = clubsResponse.data?.clubs || [];

        setProfileData({
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          contactNumber: user?.contactNumber || "",
          collegeOrgName: user?.collegeOrgName || "",
          batch: user?.batch || "",
          email: user?.email || "",
          role: user?.role || "",
        });
        setAllInterests(interests);
        setAllClubs(clubs);
        setSelectedInterests((user?.interests || []).map((item) => String(item._id || item)));
        setSelectedClubs((user?.followedClubs || []).map((item) => String(item._id || item)));
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileChange = (e) => {
    setProfileData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePasswordChange = (e) => {
    setPasswordData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleInterestCheckbox = (interestId, checked) => {
    setSelectedInterests((prev) =>
      checked
        ? prev.includes(interestId)
          ? prev
          : [...prev, interestId]
        : prev.filter((id) => id !== interestId)
    );
  };

  const handleClubCheckbox = (clubId, checked) => {
    setSelectedClubs((prev) =>
      checked ? (prev.includes(clubId) ? prev : [...prev, clubId]) : prev.filter((id) => id !== clubId)
    );
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        contactNumber: profileData.contactNumber,
        collegeOrgName: profileData.collegeOrgName,
      };

      if (profileData.role === "IIIT_PARTICIPANT") {
        payload.batch = profileData.batch;
      }

      await api.put("/user/profile", payload);
      setMessage("Profile updated successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setError("");
    setMessage("");
    try {
      await api.put("/user/password", passwordData);
      setPasswordData({ currentPassword: "", newPassword: "" });
      setMessage("Password changed successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const submitInterests = async (e) => {
    e.preventDefault();
    setSavingInterests(true);
    setError("");
    setMessage("");
    try {
      const response = await api.put("/user/interests", { interests: selectedInterests });
      setSelectedInterests(
        (response.data?.user?.interests || []).map((item) => String(item._id || item))
      );
      setMessage("Interests updated successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update interests");
    } finally {
      setSavingInterests(false);
    }
  };

  const submitFollowedClubs = async (e) => {
    e.preventDefault();
    setSavingClubs(true);
    setError("");
    setMessage("");
    try {
      const response = await api.put("/user/followed-clubs", { followedClubs: selectedClubs });
      setSelectedClubs(
        (response.data?.user?.followedClubs || []).map((item) => String(item._id || item))
      );
      setMessage("Followed clubs updated successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update followed clubs");
    } finally {
      setSavingClubs(false);
    }
  };

  if (loading) return <p>Loading profile...</p>;

  return (
    <div>
      <ParticipantNavbar />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
        {error && <p>{error}</p>}
        {message && <p>{message}</p>}
        </CardContent>
      </Card>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
      <form onSubmit={submitProfile}>
        <p>Email : {profileData.email}</p>
        <p>Role : {profileData.role}</p>

        <Label htmlFor="profile-first-name">First Name</Label>
        <Input
          id="profile-first-name"
          name="firstName"
          value={profileData.firstName}
          onChange={handleProfileChange}
        />

        <Label htmlFor="profile-last-name">Last Name</Label>
        <Input
          id="profile-last-name"
          name="lastName"
          value={profileData.lastName}
          onChange={handleProfileChange}
        />

        <Label htmlFor="profile-contact-number">Contact Number</Label>
        <Input
          id="profile-contact-number"
          name="contactNumber"
          value={profileData.contactNumber}
          onChange={handleProfileChange}
        />

        {profileData.role === "NON_IIIT_PARTICIPANT" && (
          <>
            <Label htmlFor="profile-college">College/Organization Name</Label>
            <Input
              id="profile-college"
              name="collegeOrgName"
              value={profileData.collegeOrgName}
              onChange={handleProfileChange}
            />
          </>
        )}
        {profileData.role === "IIIT_PARTICIPANT" && (
          <>
            <Label htmlFor="profile-batch">Batch</Label>
            <Input
              id="profile-batch"
              value={profileData.batch || "Not set"}
              readOnly
            />
          </>
        )}
        <Button type="submit" disabled={savingProfile} variant="outline">
          {savingProfile ? "Saving..." : "Save Profile"}
        </Button>
      </form>
        </CardContent>
      </Card>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
      <form onSubmit={submitPassword}>
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          name="currentPassword"
          value={passwordData.currentPassword}
          onChange={handlePasswordChange}
        />

        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          name="newPassword"
          value={passwordData.newPassword}
          onChange={handlePasswordChange}
        />

        <Button type="submit" disabled={savingPassword} variant="outline">
          {savingPassword ? "Updating..." : "Change Password"}
        </Button>
      </form>
        </CardContent>
      </Card>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Interests</CardTitle>
        </CardHeader>
        <CardContent>
      <form onSubmit={submitInterests}>
        {allInterests.length === 0 ? (
          <p>No interests available</p>
        ) : (
          allInterests.map((interest) => (
            <div key={interest._id}>
              <Checkbox
                id={`profile-interest-${interest._id}`}
                checked={selectedInterests.includes(interest._id)}
                onCheckedChange={(checked) => handleInterestCheckbox(interest._id, checked === true)}
              />
              <Label htmlFor={`profile-interest-${interest._id}`}>{interest.name}</Label>
            </div>
          ))
        )}
        <Button type="submit" disabled={savingInterests} variant="outline">
          {savingInterests ? "Saving..." : "Save Interests"}
        </Button>
      </form>
        </CardContent>
      </Card>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Followed Clubs</CardTitle>
        </CardHeader>
        <CardContent>
      <form onSubmit={submitFollowedClubs}>
        {allClubs.length === 0 ? (
          <p>No clubs available</p>
        ) : (
          allClubs.map((club) => (
            <div key={club._id}>
              <Checkbox
                id={`profile-club-${club._id}`}
                checked={selectedClubs.includes(club._id)}
                onCheckedChange={(checked) => handleClubCheckbox(club._id, checked === true)}
              />
              <Label htmlFor={`profile-club-${club._id}`}>{club.organizerName}</Label>
            </div>
          ))
        )}
        <Button type="submit" disabled={savingClubs} variant="outline">
          {savingClubs ? "Saving..." : "Save Followed Clubs"}
        </Button>
      </form>
        </CardContent>
      </Card>
    </div>
  );
}
