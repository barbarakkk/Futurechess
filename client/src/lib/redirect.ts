/** Only honor same-origin relative paths — never hand a query param straight to navigate(). */
export function getSafeRedirect(value: string | null): string | null {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}
