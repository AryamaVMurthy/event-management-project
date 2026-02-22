export const canEditFieldInPublished = new Set([
  "description",
  "registrationDeadline",
  "registrationLimit",
  "tags",
]);

const toSlug = (value, fallback) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

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

export const normalizeCreatePayload = (body, organizerId) =>
  canonicalizeEventInternals({
    ...body,
    organizerId: String(organizerId),
  });

export const normalizeUpdatePayload = (body) => {
  const payload = { ...body };
  delete payload.organizerId;
  delete payload.status;
  return canonicalizeEventInternals(payload);
};
