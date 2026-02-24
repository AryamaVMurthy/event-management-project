// Ticket Details: Module level logic for the feature area.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Format Date Time: Converts date values into UI-facing formatted strings. Inputs: value. Returns: a function result.
const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

// Ticket Details: Runs Ticket details flow. Inputs: none. Returns: a function result.
export default function TicketDetails() {
  const { ticketId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    // Load Ticket: Loads ticket details using the ticket id route parameter. Inputs: none. Returns: a function result.
    const loadTicket = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/tickets/${ticketId}`);
        setTicket(response.data?.ticket || null);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load ticket");
        setTicket(null);
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      loadTicket();
    }
  }, [ticketId]);

  return (
    <div className="space-y-4">
      <ParticipantNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading ticket...</p>
          ) : error ? (
            <p>{error}</p>
          ) : !ticket ? (
            <p>Ticket not found.</p>
          ) : (
            <div className="space-y-2">
              <p>Ticket ID: {ticket.ticketId}</p>
              <p>Issued At: {formatDateTime(ticket.issuedAt)}</p>
              <p>Participant: {ticket.participant?.name || "-"}</p>
              <p>Participant Email: {ticket.participant?.email || "-"}</p>
              <p>Event: {ticket.event?.name || "-"}</p>
              <p>Event Type: {ticket.event?.type || "-"}</p>
              <p>Start: {formatDateTime(ticket.event?.startDate)}</p>
              <p>End: {formatDateTime(ticket.event?.endDate)}</p>
              <p>Status: {ticket.registration?.status || "-"}</p>
              <p>Team Name: {ticket.registration?.teamName || "-"}</p>

              {ticket.qrCodeDataUrl ? (
                <div className="space-y-2">
                  <p>QR Code:</p>
                  <img src={ticket.qrCodeDataUrl} alt="Ticket QR" className="max-w-[260px]" />
                </div>
              ) : (
                <p>QR Code: -</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

