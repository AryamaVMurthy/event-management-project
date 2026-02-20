import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function TicketDetails() {
  const { ticketId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
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

