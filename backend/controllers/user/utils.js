export const toUniqueIdStrings = (values = []) =>
  [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
