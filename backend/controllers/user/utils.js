// To Unique Id Strings: Converts unique id strings to a different representation.
// Utils: Controller level logic for the feature area.
// To Unique Id Strings: Converts arbitrary ids into normalized string forms. Inputs: values. Returns: a function result.
export const toUniqueIdStrings = (values = []) =>
  [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
