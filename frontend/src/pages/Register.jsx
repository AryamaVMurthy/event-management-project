import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Register() {
  const batchOptions = ['UG1', 'UG2', 'UG3', 'UG4', 'MS', 'Mtech', 'PhD', 'PDM'];
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    contactNumber: '',
    participantType: '',
    collegeOrgName: '',
    batch: '',
    interests: [],
    followedClubs: [],
  });
  const [interests, setInterests] = useState([]);
  const [clubs, setClubs] = useState([]);
  
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();
  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  useEffect(() => {
    const loadPreferencesOptions = async () => {
      try {
        const [interestsResponse, clubsResponse] = await Promise.all([
          api.get('/interests'),
          api.get('/clubs'),
        ]);
        setInterests(interestsResponse.data?.interests || []);
        setClubs(clubsResponse.data?.clubs || []);
      } catch {
        setError('Failed to load onboarding preferences');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadPreferencesOptions();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleParticipantTypeChange = (value) => {
    setFormData((prev) => ({ ...prev, participantType: value }));
    setError('');
  };

  const handleBatchChange = (value) => {
    setFormData((prev) => ({ ...prev, batch: value }));
    setError('');
  };

  const handleInterestChange = (id, checked) => {
    setFormData((prev) => ({
      ...prev,
      interests: checked
        ? [...prev.interests, id]
        : prev.interests.filter((interestId) => interestId !== id),
    }));
  };

  const handleClubChange = (id, checked) => {
    setFormData((prev) => ({
      ...prev,
      followedClubs: checked
        ? [...prev.followedClubs, id]
        : prev.followedClubs.filter((clubId) => clubId !== id),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
  if (
  !formData.email ||
  !formData.password ||
  !formData.firstName ||
  !formData.lastName ||
  !formData.contactNumber ||
  !formData.participantType
) {
  setError("All fields required");
  return;
}

if (formData.participantType === "NON_IIIT_PARTICIPANT" && !formData.collegeOrgName) {
  setError("College is required for Non-IIIT participants");
  return;
}


    if (formData.participantType === 'IIIT_PARTICIPANT') {
      const iiitRegex = /@.*\.iiit\.ac\.in$/;
      if (!iiitRegex.test(formData.email)) {
        setError('IIIT email required');
        return;
      }
    }

    const payload = {
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      contactNumber: formData.contactNumber,
      participantType: formData.participantType,
      interests: formData.interests,
      followedClubs: formData.followedClubs,
    };

    if (formData.participantType === 'IIIT_PARTICIPANT') {
      payload.batch = formData.batch;
    } else {
      payload.collegeOrgName = formData.collegeOrgName;
    }

    const result = await register(payload);
    if (result.success) {
      navigate(getDashboardRoute(result.user.role));
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && <p>{error}</p>}

            <Label>Type *</Label>
            <RadioGroup value={formData.participantType} onValueChange={handleParticipantTypeChange}>
              <div>
                <RadioGroupItem id="type-iiit" value="IIIT_PARTICIPANT" />
                <Label htmlFor="type-iiit">IIIT</Label>
              </div>
              <div>
                <RadioGroupItem id="type-non-iiit" value="NON_IIIT_PARTICIPANT" />
                <Label htmlFor="type-non-iiit">Non-IIIT</Label>
              </div>
            </RadioGroup>

            <Label htmlFor="register-first-name">First Name *</Label>
            <Input id="register-first-name" name="firstName" value={formData.firstName} onChange={handleChange} />

            <Label htmlFor="register-last-name">Last Name *</Label>
            <Input id="register-last-name" name="lastName" value={formData.lastName} onChange={handleChange} />

            <Label htmlFor="register-email">Email *</Label>
            <Input id="register-email" name="email" type="email" value={formData.email} onChange={handleChange} />

            <Label htmlFor="register-password">Password *</Label>
            <Input id="register-password" name="password" type="password" value={formData.password} onChange={handleChange} />

            <Label htmlFor="register-contact">Contact *</Label>
            <Input id="register-contact" name="contactNumber" value={formData.contactNumber} onChange={handleChange} />

            {formData.participantType === 'IIIT_PARTICIPANT' && (
              <>
                <Label>Batch</Label>
                <Select value={formData.batch} onValueChange={handleBatchChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batchOptions.map((batch, index) => (
                      <SelectItem key={`${batch}-${index}`} value={batch}>
                        {batch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {formData.participantType === 'NON_IIIT_PARTICIPANT' && (
              <>
                <Label htmlFor="register-college">College *</Label>
                <Input id="register-college" name="collegeOrgName" value={formData.collegeOrgName} onChange={handleChange} />
              </>
            )}

            <Separator />
            <Label>Areas of Interest (optional)</Label>
            {loadingOptions ? (
              <p>Loading interests...</p>
            ) : (
              interests.map((interest) => (
                <div key={interest._id}>
                  <Checkbox
                    id={`interest-${interest._id}`}
                    checked={formData.interests.includes(interest._id)}
                    onCheckedChange={(checked) => handleInterestChange(interest._id, checked === true)}
                  />
                  <Label htmlFor={`interest-${interest._id}`}>{interest.name}</Label>
                </div>
              ))
            )}

            <Separator />
            <Label>Clubs to Follow (optional)</Label>
            {loadingOptions ? (
              <p>Loading clubs...</p>
            ) : (
              clubs.map((club) => (
                <div key={club._id}>
                  <Checkbox
                    id={`club-${club._id}`}
                    checked={formData.followedClubs.includes(club._id)}
                    onCheckedChange={(checked) => handleClubChange(club._id, checked === true)}
                  />
                  <Label htmlFor={`club-${club._id}`}>{club.organizerName}</Label>
                </div>
              ))
            )}

            <Button type="submit" variant="outline">Register</Button>
          </form>
        </CardContent>
        <CardFooter>
          <p>Have account?</p>
          <Separator orientation="vertical" />
          <Button asChild variant="outline">
            <Link to="/login">Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
