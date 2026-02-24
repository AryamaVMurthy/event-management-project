// Organizer Create Event: Module level logic for the feature area.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import OrganizerNavbar from "../components/OrganizerNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const eventTypeOptions = ["NORMAL", "MERCHANDISE"];
const eligibilityOptions = ["ALL", "IIIT_ONLY", "NON_IIIT_ONLY"];
const formFieldTypes = ["text", "dropdown", "checkbox", "file"];

// Default Field: Runs Default field flow. Inputs: none. Returns: a function result.
const defaultField = () => ({
  type: "text",
  label: "",
  required: false,
  optionsText: "",
  maxFileSizeMB: 5,
  allowedMimeTypesText: "",
});

// Default Item: Runs Default item flow. Inputs: none. Returns: a function result.
const defaultItem = () => ({
  name: "",
  description: "",
  purchaseLimitPerParticipant: 1,
  variants: [
    {
      size: "",
      color: "",
      label: "",
      price: 0,
      stockQty: 0,
    },
  ],
});

// Organizer Create Event: Runs Organizer create event flow. Inputs: none. Returns: a function result.
export default function OrganizerCreateEvent() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: "",
    startDate: "",
    endDate: "",
    registrationLimit: 100,
    registrationFee: 0,
    tagsText: "",
  });

  const [customFormSchema, setCustomFormSchema] = useState([defaultField()]);
  const [items, setItems] = useState([defaultItem()]);

  const isNormal = form.type === "NORMAL";

  const normalizedCustomFields = useMemo(
    () =>
      customFormSchema
        .filter((field) => field.label.trim())
        .map((field, index) => ({
          type: field.type,
          label: field.label.trim(),
          required: Boolean(field.required),
          order: index,
          options:
            field.type === "dropdown" || field.type === "checkbox"
              ? field.optionsText
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [],
          maxFileSizeMB: field.type === "file" ? Number(field.maxFileSizeMB || 5) : undefined,
          allowedMimeTypes:
            field.type === "file"
              ? field.allowedMimeTypesText
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [],
        })),
    [customFormSchema]
  );

  const normalizedItems = useMemo(
    () =>
      items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          description: item.description.trim(),
          purchaseLimitPerParticipant: Number(item.purchaseLimitPerParticipant || 1),
          variants: (item.variants || [])
            .filter((variant) => variant.label.trim())
            .map((variant) => ({
              size: variant.size.trim(),
              color: variant.color.trim(),
              label: variant.label.trim(),
              price: Number(variant.price || 0),
              stockQty: Number(variant.stockQty || 0),
            })),
        })),
    [items]
  );

  // Update Field: Updates field based on input. Inputs: key, value. Returns: side effects and response to caller.
  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Submit: Submits the pending action payload to backend services. Inputs: event. Returns: side effects and response to caller.
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        eligibility: form.eligibility,
        registrationDeadline: form.registrationDeadline,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationLimit: Number(form.registrationLimit || 1),
        registrationFee: Number(form.registrationFee || 0),
        tags: form.tagsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        customFormSchema: isNormal ? normalizedCustomFields : [],
        items: isNormal ? [] : normalizedItems,
      };

      const response = await api.post("/events", payload);
      const eventId = response.data?.event?._id;
      setMessage("Draft event created");
      if (eventId) {
        navigate(`/organizer/events/${eventId}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <OrganizerNavbar />

      <Card>
        <CardHeader>
          <CardTitle>Create Event (Draft)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p>{error}</p> : null}
          {message ? <p>{message}</p> : null}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="event-name">Name</Label>
              <Input id="event-name" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-desc">Description</Label>
              <Textarea id="event-desc" value={form.description} onChange={(e) => updateField("description", e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => updateField("type", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Eligibility</Label>
              <Select value={form.eligibility} onValueChange={(value) => updateField("eligibility", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eligibilityOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="event-deadline">Registration Deadline</Label>
              <Input id="event-deadline" type="datetime-local" value={form.registrationDeadline} onChange={(e) => updateField("registrationDeadline", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-start">Start Date</Label>
              <Input id="event-start" type="datetime-local" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-end">End Date</Label>
              <Input id="event-end" type="datetime-local" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-limit">Registration Limit</Label>
              <Input id="event-limit" type="number" min="1" value={form.registrationLimit} onChange={(e) => updateField("registrationLimit", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-fee">Registration Fee</Label>
              <Input id="event-fee" type="number" min="0" value={form.registrationFee} onChange={(e) => updateField("registrationFee", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="event-tags">Tags (comma separated)</Label>
              <Input id="event-tags" value={form.tagsText} onChange={(e) => updateField("tagsText", e.target.value)} />
            </div>

            {isNormal ? (
              <Card>
                <CardHeader>
                  <CardTitle>Custom Registration Form</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customFormSchema.map((field, index) => (
                    <Card key={`field-${index}`}>
                      <CardContent className="space-y-2 pt-4">
                        <p>Field {index + 1}</p>
                        <Input placeholder="Label" value={field.label} onChange={(e) => {
                          const next = [...customFormSchema];
                          next[index].label = e.target.value;
                          setCustomFormSchema(next);
                        }} />
                        <Select value={field.type} onValueChange={(value) => {
                          const next = [...customFormSchema];
                          next[index].type = value;
                          setCustomFormSchema(next);
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {formFieldTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        {(field.type === "dropdown" || field.type === "checkbox") ? (
                          <Input
                            placeholder="Options (comma separated)"
                            value={field.optionsText}
                            onChange={(e) => {
                              const next = [...customFormSchema];
                              next[index].optionsText = e.target.value;
                              setCustomFormSchema(next);
                            }}
                          />
                        ) : null}

                        {field.type === "file" ? (
                          <>
                            <Input
                              type="number"
                              min="1"
                              max="25"
                              placeholder="Max file size MB"
                              value={field.maxFileSizeMB}
                              onChange={(e) => {
                                const next = [...customFormSchema];
                                next[index].maxFileSizeMB = e.target.value;
                                setCustomFormSchema(next);
                              }}
                            />
                            <Input
                              placeholder="Allowed mime types (comma separated)"
                              value={field.allowedMimeTypesText}
                              onChange={(e) => {
                                const next = [...customFormSchema];
                                next[index].allowedMimeTypesText = e.target.value;
                                setCustomFormSchema(next);
                              }}
                            />
                          </>
                        ) : null}

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(checked) => {
                              const next = [...customFormSchema];
                              next[index].required = checked === true;
                              setCustomFormSchema(next);
                            }}
                          />
                          <Label>Required</Label>
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" variant="outline" disabled={index === 0} onClick={() => {
                            const next = [...customFormSchema];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            setCustomFormSchema(next);
                          }}>Move Up</Button>
                          <Button type="button" variant="outline" disabled={index === customFormSchema.length - 1} onClick={() => {
                            const next = [...customFormSchema];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            setCustomFormSchema(next);
                          }}>Move Down</Button>
                          <Button type="button" variant="outline" onClick={() => {
                            const next = customFormSchema.filter((_, i) => i !== index);
                            setCustomFormSchema(next.length ? next : [defaultField()]);
                          }}>Remove</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setCustomFormSchema((prev) => [...prev, defaultField()])}>
                    Add Field
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Merchandise Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item, itemIndex) => (
                    <Card key={`item-${itemIndex}`}>
                      <CardContent className="space-y-2 pt-4">
                        <Input placeholder="Item Name" value={item.name} onChange={(e) => {
                          const next = [...items];
                          next[itemIndex].name = e.target.value;
                          setItems(next);
                        }} />
                        <Input placeholder="Description" value={item.description} onChange={(e) => {
                          const next = [...items];
                          next[itemIndex].description = e.target.value;
                          setItems(next);
                        }} />
                        <Input type="number" min="1" placeholder="Purchase limit per participant" value={item.purchaseLimitPerParticipant} onChange={(e) => {
                          const next = [...items];
                          next[itemIndex].purchaseLimitPerParticipant = e.target.value;
                          setItems(next);
                        }} />

                        {(item.variants || []).map((variant, variantIndex) => (
                          <Card key={`variant-${itemIndex}-${variantIndex}`}>
                            <CardContent className="space-y-2 pt-4">
                              <Input placeholder="Label" value={variant.label} onChange={(e) => {
                                const next = [...items];
                                next[itemIndex].variants[variantIndex].label = e.target.value;
                                setItems(next);
                              }} />
                              <Input placeholder="Size" value={variant.size} onChange={(e) => {
                                const next = [...items];
                                next[itemIndex].variants[variantIndex].size = e.target.value;
                                setItems(next);
                              }} />
                              <Input placeholder="Color" value={variant.color} onChange={(e) => {
                                const next = [...items];
                                next[itemIndex].variants[variantIndex].color = e.target.value;
                                setItems(next);
                              }} />
                              <Input type="number" min="0" placeholder="Price" value={variant.price} onChange={(e) => {
                                const next = [...items];
                                next[itemIndex].variants[variantIndex].price = e.target.value;
                                setItems(next);
                              }} />
                              <Input type="number" min="0" placeholder="Stock Qty" value={variant.stockQty} onChange={(e) => {
                                const next = [...items];
                                next[itemIndex].variants[variantIndex].stockQty = e.target.value;
                                setItems(next);
                              }} />
                              <Button type="button" variant="outline" onClick={() => {
                                const next = [...items];
                                next[itemIndex].variants = next[itemIndex].variants.filter((_, i) => i !== variantIndex);
                                if (next[itemIndex].variants.length === 0) {
                                  next[itemIndex].variants = [defaultItem().variants[0]];
                                }
                                setItems(next);
                              }}>Remove Variant</Button>
                            </CardContent>
                          </Card>
                        ))}
                        <Button type="button" variant="outline" onClick={() => {
                          const next = [...items];
                          next[itemIndex].variants.push(defaultItem().variants[0]);
                          setItems(next);
                        }}>Add Variant</Button>
                        <Button type="button" variant="outline" onClick={() => {
                          const next = items.filter((_, i) => i !== itemIndex);
                          setItems(next.length ? next : [defaultItem()]);
                        }}>Remove Item</Button>
                      </CardContent>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, defaultItem()])}>Add Item</Button>
                </CardContent>
              </Card>
            )}

            <Button type="submit" variant="outline" disabled={submitting}>
              {submitting ? "Creating..." : "Create Draft Event"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
