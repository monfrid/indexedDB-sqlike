const PRIMITIVES = ["string", "number", "null", "boolean", "undefined"];

export const isPrimitive = (type) => PRIMITIVES.includes(type);

export const typeOf = (value) =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;

export const parseEntries = (object) =>
  Object.entries(object).filter(([, value]) => value !== undefined);

export const merge = (prev, next) => {
  for (const key in next) {
    const prevItem = prev[key];
    const prevType = typeOf(prevItem);
    const nextItem = next[key];
    const nextType = typeOf(nextItem);
    if (isPrimitive(prevType) || isPrimitive(nextType)) {
      prev[key] = next[key];
    } else if (prevType === "array" && nextType === "array") {
      prev[key] = [...prevItem, ...nextItem];
    } else if (prevType === "object" && nextType === "object") {
      prev[key] = merge(prevItem, nextItem);
    }
  }
  return prev;
};
