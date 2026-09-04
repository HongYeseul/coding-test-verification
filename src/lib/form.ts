export function getRequiredText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export function withStatus(
  path: string,
  type: "error" | "message",
  value: string,
) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${type}=${encodeURIComponent(value)}`;
}

export function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
