import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import ParticipantNavbar from "../components/ParticipantNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const eligibilityOptions = [
  { value: "ALL", label: "All" },
  { value: "IIIT_ONLY", label: "IIIT Only" },
  { value: "NON_IIIT_ONLY", label: "Non-IIIT Only" },
];

const typeOptions = [
  { value: "NORMAL", label: "Normal" },
  { value: "MERCHANDISE", label: "Merchandise" },
];

const blockedReasonLabels = {
  EVENT_NOT_OPEN: "Event is not open for registrations right now",
  DEADLINE_PASSED: "Registration deadline has passed",
  NOT_ELIGIBLE: "You are not eligible for this event",
  REGISTRATION_FULL: "Registration limit has been reached",
  ALREADY_REGISTERED: "You are already registered",
  STOCK_EXHAUSTED: "Stock is exhausted",
};

const toLocalDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function BrowseEvents() {
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [events, setEvents] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [listMeta, setListMeta] = useState({
    followedOnly: false,
    followedClubCount: 0,
    noFollowedClubs: false,
    personalizationApplied: false,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    type: "",
    eligibility: "",
    dateFrom: "",
    dateTo: "",
    clubScope: "all",
  });

  const [selectedEventId, setSelectedEventId] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [eventDetails, setEventDetails] = useState(null);

  const [teamName, setTeamName] = useState("");
  const [responses, setResponses] = useState({});
  const [fileResponses, setFileResponses] = useState({});

  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = useMemo(() => {
    if (!eventDetails || eventDetails.type !== "MERCHANDISE") return null;
    return (eventDetails.items || []).find((item) => item.itemId === selectedItemId) || null;
  }, [eventDetails, selectedItemId]);

  const selectedVariant = useMemo(() => {
    if (!selectedItem) return null;
    return (
      (selectedItem.variants || []).find((variant) => variant.variantId === selectedVariantId) ||
      null
    );
  }, [selectedItem, selectedVariantId]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedVariantId("");
      return;
    }

    const variants = selectedItem.variants || [];
    const variantExists = variants.some((variant) => variant.variantId === selectedVariantId);
    if (!variantExists) {
      setSelectedVariantId(variants[0]?.variantId || "");
    }
  }, [selectedItem, selectedVariantId]);

  const loadEvents = async (nextFilters = filters) => {
    setLoadingEvents(true);
    setError("");
    try {
      const params = {};
      if (nextFilters.search) params.search = nextFilters.search;
      if (nextFilters.type) params.type = nextFilters.type;
      if (nextFilters.eligibility) params.eligibility = nextFilters.eligibility;
      if (nextFilters.dateFrom) params.dateFrom = nextFilters.dateFrom;
      if (nextFilters.dateTo) params.dateTo = nextFilters.dateTo;
      if (nextFilters.clubScope === "followed") params.followedOnly = "true";

      const response = await api.get("/events", { params });
      const list = response.data?.events || [];
      setEvents(list);
      setRecommendedEvents(response.data?.recommendedEvents || []);
      setTrendingEvents(response.data?.trendingEvents || []);
      setListMeta(
        response.data?.meta || {
          followedOnly: nextFilters.clubScope === "followed",
          followedClubCount: 0,
          noFollowedClubs: false,
          personalizationApplied: false,
        }
      );

      if (list.length === 0) {
        setSelectedEventId("");
        setEventDetails(null);
      } else {
        const exists = list.some((event) => event.id === selectedEventId);
        setSelectedEventId(exists ? selectedEventId : list[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load events");
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadEventDetails = async (eventId) => {
    if (!eventId) {
      setEventDetails(null);
      return;
    }

    setLoadingDetails(true);
    setError("");
    try {
      const response = await api.get(`/events/${eventId}`);
      const event = response.data?.event || null;
      setEventDetails(event);
      setTeamName("");
      setResponses({});
      setFileResponses({});

      if (event?.type === "MERCHANDISE" && Array.isArray(event.items) && event.items.length > 0) {
        const firstItem = event.items[0];
        const firstVariant = firstItem.variants?.[0];
        setSelectedItemId(firstItem.itemId);
        setSelectedVariantId(firstVariant?.variantId || "");
        setQuantity("1");
      } else {
        setSelectedItemId("");
        setSelectedVariantId("");
        setQuantity("1");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load event details");
      setEventDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadEventDetails(selectedEventId);
    }
  }, [selectedEventId]);

  const onFilterInput = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadEvents(filters);
  };

  const clearFilters = async () => {
    const cleared = {
      search: "",
      type: "",
      eligibility: "",
      dateFrom: "",
      dateTo: "",
      clubScope: "all",
    };
    setFilters(cleared);
    await loadEvents(cleared);
  };

  const setRadioResponse = (fieldId, value) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const setTextareaResponse = (fieldId, value) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const setCheckboxResponse = (fieldId, option, checked) => {
    setResponses((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const next = checked ? [...current, option] : current.filter((item) => item !== option);
      return { ...prev, [fieldId]: next };
    });
  };

  const submitNormalRegistration = async (event) => {
    event.preventDefault();
    if (!eventDetails) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const hasFileFields = (eventDetails.customFormSchema || []).some(
        (field) => field.type === "file"
      );

      let response;
      if (hasFileFields) {
        const formData = new FormData();
        formData.append("responses", JSON.stringify(responses));
        if (teamName.trim()) {
          formData.append("teamName", teamName.trim());
        }

        Object.entries(fileResponses).forEach(([fieldId, file]) => {
          if (file) {
            formData.append(fieldId, file);
          }
        });

        response = await api.post(`/events/${eventDetails.id}/register`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const payload = { responses };
        if (teamName.trim()) payload.teamName = teamName.trim();
        response = await api.post(`/events/${eventDetails.id}/register`, payload);
      }

      const ticketId = response.data?.ticket?.ticketId;
      setMessage(ticketId ? `Registered successfully. Ticket: ${ticketId}` : "Registered successfully");
      await loadEvents(filters);
      await loadEventDetails(eventDetails.id);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitMerchPurchase = async (event) => {
    event.preventDefault();
    if (!eventDetails) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        itemId: selectedItemId,
        variantId: selectedVariantId,
        quantity: Number(quantity),
      };
      const response = await api.post(`/events/${eventDetails.id}/purchase`, payload);
      const ticketId = response.data?.ticket?.ticketId;
      setMessage(ticketId ? `Purchase successful. Ticket: ${ticketId}` : "Purchase successful");
      await loadEvents(filters);
      await loadEventDetails(eventDetails.id);
    } catch (err) {
      setError(err.response?.data?.message || "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ParticipantNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Browse Events</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="events-search">Search</Label>
              <Input
                id="events-search"
                name="search"
                value={filters.search}
                onChange={onFilterInput}
                placeholder="Search by event or organizer"
              />
            </div>

            <div>
              <Label htmlFor="events-type">Type</Label>
              <Select
                value={filters.type || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value === "__all__" ? "" : value }))
                }
              >
                <SelectTrigger id="events-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="events-eligibility">Eligibility</Label>
              <Select
                value={filters.eligibility || "__all__"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    eligibility: value === "__all__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="events-eligibility">
                  <SelectValue placeholder="All eligibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any</SelectItem>
                  {eligibilityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
            </div>

            <div>
              <Label htmlFor="events-club-scope">Clubs Filter</Label>
              <Select
                value={filters.clubScope}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, clubScope: value }))
                }
              >
                <SelectTrigger id="events-club-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="followed">Followed clubs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="events-date-from">Date From</Label>
              <Input
                id="events-date-from"
                name="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={onFilterInput}
              />
            </div>

            <div>
              <Label htmlFor="events-date-to">Date To</Label>
              <Input
                id="events-date-to"
                name="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={onFilterInput}
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" variant="outline" disabled={loadingEvents}>
                {loadingEvents ? "Loading..." : "Apply Filters"}
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters} disabled={loadingEvents}>
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended for You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!listMeta.personalizationApplied ? (
            <p>Add interests or follow clubs to get personalized recommendations.</p>
          ) : recommendedEvents.length === 0 ? (
            <p>No personalized recommendations available right now.</p>
          ) : (
            recommendedEvents.map((event) => (
              <Card key={`recommended-${event.id}`}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p>Organizer: {event.organizer?.organizerName || "-"}</p>
                  <p>Type: {event.type}</p>
                  <p>Start: {toLocalDateTime(event.startDate)}</p>
                  <Button type="button" variant="outline" onClick={() => setSelectedEventId(event.id)}>
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trending (Top 5 in last 24h)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingEvents.length === 0 ? (
            <p>No trending events right now.</p>
          ) : (
            trendingEvents.map((event) => (
              <Card key={`trending-${event.id}`}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p>Organizer: {event.organizer?.organizerName || "-"}</p>
                  <p>Type: {event.type}</p>
                  <p>Start: {toLocalDateTime(event.startDate)}</p>
                  <p>Registrations (24h): {event.registrationCount24h || 0}</p>
                  <Button type="button" variant="outline" onClick={() => setSelectedEventId(event.id)}>
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filters.clubScope === "followed" && listMeta.noFollowedClubs && (
            <p>You are not following any clubs yet. Follow clubs in Clubs/Organizers to use this filter.</p>
          )}
          {loadingEvents ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p>No events found.</p>
          ) : (
            events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p>Type: {event.type}</p>
                  <p>Organizer: {event.organizer?.organizerName || "-"}</p>
                  <p>Start: {toLocalDateTime(event.startDate)}</p>
                  <p>Eligibility: {event.eligibility}</p>
                  <Button
                    type="button"
                    variant={selectedEventId === event.id ? "default" : "outline"}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    {selectedEventId === event.id ? "Viewing" : "View Details"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Details & Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p>{error}</p>}
          {message && <p>{message}</p>}

          {loadingDetails ? (
            <p>Loading event details...</p>
          ) : !eventDetails ? (
            <p>Select an event to view details.</p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <p>Name: {eventDetails.name}</p>
                <p>Type: {eventDetails.type}</p>
                <p>Organizer: {eventDetails.organizer?.organizerName || "-"}</p>
                <p>Status: {eventDetails.status}</p>
                <p>Registration Deadline: {toLocalDateTime(eventDetails.registrationDeadline)}</p>
                <p>Start: {toLocalDateTime(eventDetails.startDate)}</p>
                <p>End: {toLocalDateTime(eventDetails.endDate)}</p>
                <p>Registrations: {eventDetails.registrationCount || 0}</p>
                <p>Eligibility: {eventDetails.eligibility}</p>
                <p>Registration Limit: {eventDetails.registrationLimit}</p>
                <p>Registration Fee: Rs. {eventDetails.registrationFee}</p>
                <p>Tags: {(eventDetails.tags || []).length ? eventDetails.tags.join(", ") : "-"}</p>
              </div>

              <p>Description: {eventDetails.description}</p>

              {!eventDetails.canRegisterOrPurchase && (
                <Card>
                  <CardHeader>
                    <CardTitle>Why registration is blocked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5">
                      {(eventDetails.blockedReasons || []).map((reason) => (
                        <li key={reason}>{blockedReasonLabels[reason] || reason}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {eventDetails.type === "NORMAL" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Register for Event</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={submitNormalRegistration} className="space-y-4">
                      <div>
                        <Label htmlFor="register-team-name">Team Name (optional)</Label>
                        <Input
                          id="register-team-name"
                          value={teamName}
                          onChange={(event) => setTeamName(event.target.value)}
                          placeholder="Enter team name"
                        />
                      </div>

                      {(eventDetails.customFormSchema || []).map((field) => {
                        if (field.type === "text") {
                          return (
                            <div key={field.id}>
                              <Label htmlFor={`field-${field.id}`}>
                                {field.label}
                                {field.required ? " *" : ""}
                              </Label>
                              <Input
                                id={`field-${field.id}`}
                                value={responses[field.id] || ""}
                                onChange={(event) => setTextareaResponse(field.id, event.target.value)}
                              />
                            </div>
                          );
                        }

                        if (field.type === "dropdown") {
                          return (
                            <div key={field.id}>
                              <Label htmlFor={`field-${field.id}`}>
                                {field.label}
                                {field.required ? " *" : ""}
                              </Label>
                              <Select
                                value={responses[field.id] || "__none__"}
                                onValueChange={(value) =>
                                  setRadioResponse(field.id, value === "__none__" ? "" : value)
                                }
                              >
                                <SelectTrigger id={`field-${field.id}`}>
                                  <SelectValue placeholder="Select option" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select</SelectItem>
                                  {(field.options || []).map((option) => (
                                    <SelectItem key={`${field.id}-${option}`} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        if (field.type === "checkbox") {
                          const current = Array.isArray(responses[field.id]) ? responses[field.id] : [];
                          return (
                            <div key={field.id}>
                              <Label>
                                {field.label}
                                {field.required ? " *" : ""}
                              </Label>
                              <div className="space-y-2">
                                {(field.options || []).map((option) => (
                                  <div className="flex items-center gap-2" key={`${field.id}-${option}`}>
                                    <Checkbox
                                      id={`field-${field.id}-${option}`}
                                      checked={current.includes(option)}
                                      onCheckedChange={(checked) =>
                                        setCheckboxResponse(field.id, option, checked === true)
                                      }
                                    />
                                    <Label htmlFor={`field-${field.id}-${option}`}>{option}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (field.type === "file") {
                          const selectedFile = fileResponses[field.id];
                          return (
                            <div key={field.id}>
                              <Label htmlFor={`field-${field.id}`}>
                                {field.label}
                                {field.required ? " *" : ""}
                              </Label>
                              <Input
                                id={`field-${field.id}`}
                                type="file"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0] || null;
                                  setFileResponses((prev) => ({
                                    ...prev,
                                    [field.id]: nextFile,
                                  }));
                                }}
                              />
                              {selectedFile ? <p>Selected: {selectedFile.name}</p> : null}
                            </div>
                          );
                        }

                        return null;
                      })}

                      <Button
                        type="submit"
                        variant="outline"
                        disabled={submitting || !eventDetails.canRegisterOrPurchase}
                      >
                        {submitting ? "Submitting..." : "Register"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Merchandise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={submitMerchPurchase} className="space-y-4">
                      <div>
                        <Label>Item</Label>
                        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {(eventDetails.items || []).map((item) => (
                              <SelectItem key={item.itemId} value={item.itemId}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedItem && (
                        <p>Purchase limit per participant: {selectedItem.purchaseLimitPerParticipant}</p>
                      )}

                      <div>
                        <Label>Variant</Label>
                        <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select variant" />
                          </SelectTrigger>
                          <SelectContent>
                            {(selectedItem?.variants || []).map((variant) => (
                              <SelectItem key={variant.variantId} value={variant.variantId}>
                                {variant.label} (Rs. {variant.price}, Stock: {variant.stockQty})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="purchase-quantity">Quantity</Label>
                        <Input
                          id="purchase-quantity"
                          type="number"
                          min="1"
                          max={selectedItem?.purchaseLimitPerParticipant || undefined}
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value)}
                        />
                      </div>

                      {selectedVariant && <p>Total: Rs. {Number(selectedVariant.price) * Number(quantity || 0)}</p>}

                      <Button
                        type="submit"
                        variant="outline"
                        disabled={
                          submitting ||
                          !eventDetails.canRegisterOrPurchase ||
                          !selectedItemId ||
                          !selectedVariantId
                        }
                      >
                        {submitting ? "Submitting..." : "Purchase"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
