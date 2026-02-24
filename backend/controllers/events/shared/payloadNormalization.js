// Payload Normalization: Controller level logic for the feature area.
export const canEditFieldInPublished = new Set([
  "description",
  "registrationDeadline",
  "registrationLimit",
  "tags",
]);

// To Slug: ToSlug. Converts slug into a new representation. Inputs: value, fallback. Returns: a function result.
const toSlug = (value, fallback) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

// Create Unique Id: Creates unique id from input data. Inputs: base, usedSet. Returns: side effects and response to caller.
const createUniqueId = (base, usedSet) => {
  let candidate = base;
  let counter = 2;

  while (usedSet.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  usedSet.add(candidate);
  return candidate;
};

// Canonicalize Custom Form Schema: Normalizes custom form fields for consistent downstream storage. Inputs: schema. Returns: a function result.
const canonicalizeCustomFormSchema = (schema) => {
  if (!Array.isArray(schema)) return schema;

  const usedFieldIds = new Set();
  return schema.map((field, index) => {
    const normalizedField =
      field && typeof field === "object" && !Array.isArray(field) ? { ...field } : {};
    const idBase = toSlug(
      normalizedField.label || normalizedField.type || `field-${index + 1}`,
      "field"
    );
    const generatedId = createUniqueId(idBase, usedFieldIds);

    return {
      ...normalizedField,
      id: generatedId,
      order: index,
    };
  });
};

// Canonicalize Merch Items: Normalizes merchandise item descriptors and variant data. Inputs: items. Returns: a function result.
const canonicalizeMerchItems = (items) => {
  if (!Array.isArray(items)) return items;

  const usedItemIds = new Set();
  return items.map((item, itemIndex) => {
    const normalizedItem =
      item && typeof item === "object" && !Array.isArray(item) ? { ...item } : {};
    const itemIdBase = toSlug(normalizedItem.name || `item-${itemIndex + 1}`, "item");
    const generatedItemId = createUniqueId(itemIdBase, usedItemIds);

    const variants = Array.isArray(normalizedItem.variants) ? normalizedItem.variants : [];
    const usedVariantIds = new Set();
    const canonicalVariants = variants.map((variant, variantIndex) => {
      const normalizedVariant =
        variant && typeof variant === "object" && !Array.isArray(variant)
          ? { ...variant }
          : {};
      const variantIdSeed =
        normalizedVariant.label ||
        [normalizedVariant.size, normalizedVariant.color].filter(Boolean).join(" ") ||
        `${generatedItemId} variant ${variantIndex + 1}`;
      const variantIdBase = toSlug(variantIdSeed, `${generatedItemId}-variant`);
      const generatedVariantId = createUniqueId(variantIdBase, usedVariantIds);

      return {
        ...normalizedVariant,
        variantId: generatedVariantId,
      };
    });

    return {
      ...normalizedItem,
      itemId: generatedItemId,
      variants: canonicalVariants,
    };
  });
};

// Canonicalize Event Internals: Builds a canonical event representation for validation and use. Inputs: payload. Returns: a function result.
const canonicalizeEventInternals = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalizedPayload = { ...payload };

  if (Array.isArray(normalizedPayload.customFormSchema)) {
    normalizedPayload.customFormSchema = canonicalizeCustomFormSchema(
      normalizedPayload.customFormSchema
    );
  }

  if (Array.isArray(normalizedPayload.items)) {
    normalizedPayload.items = canonicalizeMerchItems(normalizedPayload.items);
  }

  return normalizedPayload;
};

// Normalize Create Payload: Cleans and trims payload before create operations. Inputs: body, organizerId. Returns: a function result.
export const normalizeCreatePayload = (body, organizerId) =>
  canonicalizeEventInternals({
    ...body,
    organizerId: String(organizerId),
  });

// Normalize Update Payload: Cleans and trims payload before update operations. Inputs: body. Returns: a function result.
export const normalizeUpdatePayload = (body) => {
  const payload = { ...body };
  delete payload.organizerId;
  delete payload.status;
  return canonicalizeEventInternals(payload);
};
