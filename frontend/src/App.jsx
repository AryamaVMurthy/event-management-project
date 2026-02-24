// App: Module level logic for the feature area.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import BrowseEvents from './pages/BrowseEvents';
import ClubsOrganizers from './pages/ClubsOrganizers';
import OrganizerDetail from './pages/OrganizerDetail';
import TicketDetails from './pages/TicketDetails';
import AdminDashboard from './pages/AdminDashboard';
import AdminManageClubs from './pages/AdminManageClubs';
import AdminPasswordResetRequests from './pages/AdminPasswordResetRequests';
import AdminOrganizerEvents from './pages/AdminOrganizerEvents';
import AdminEventParticipants from './pages/AdminEventParticipants';
import OrganizerDashboard from './pages/OrganizerDashboard';
import OrganizerCreateEvent from './pages/OrganizerCreateEvent';
import OrganizerEventDetails from './pages/OrganizerEventDetails';
import OrganizerOngoingEvents from './pages/OrganizerOngoingEvents';
import OrganizerProfile from './pages/OrganizerProfile';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute'; 

// App: Runs App flow. Inputs: none. Returns: a function result.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><BrowseEvents /></ProtectedRoute>} />
          <Route path="/clubs" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><ClubsOrganizers /></ProtectedRoute>} />
          <Route path="/clubs/:id" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><OrganizerDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><Profile /></ProtectedRoute>} />
          <Route path="/tickets/:ticketId" element={<ProtectedRoute allowedRoles={["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"]}><TicketDetails /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/clubs" element={<ProtectedRoute allowedRoles={["admin"]}><AdminManageClubs /></ProtectedRoute>} />
          <Route path="/admin/organizers/:organizerId/events" element={<ProtectedRoute allowedRoles={["admin"]}><AdminOrganizerEvents /></ProtectedRoute>} />
          <Route path="/admin/events/:eventId/participants" element={<ProtectedRoute allowedRoles={["admin"]}><AdminEventParticipants /></ProtectedRoute>} />
          <Route path="/admin/password-reset-requests" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPasswordResetRequests /></ProtectedRoute>} />
          <Route path="/organizer/dashboard" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerDashboard /></ProtectedRoute>} />
          <Route path="/organizer/events/new" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerCreateEvent /></ProtectedRoute>} />
          <Route path="/organizer/events/ongoing" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerOngoingEvents /></ProtectedRoute>} />
          <Route path="/organizer/events/:id" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerEventDetails /></ProtectedRoute>} />
          <Route path="/organizer/profile" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerProfile /></ProtectedRoute>} />
          <Route path="*" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
