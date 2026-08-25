export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  // Zod validation errors (server code VALIDATION_ERROR) only carry a generic
  // "Validation error" message plus a structured `issues` array — surface the
  // actual per-field problem (e.g. "whatsappLink: String must contain at most
  // 200 character(s)") instead of the unhelpful generic text.
  const issues = (error as any)?.response?.data?.error?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const detail = issues
      .map((issue: any) => {
        const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
        const message = typeof issue?.message === "string" ? issue.message : "";
        return path ? `${path}: ${message}` : message;
      })
      .filter(Boolean)
      .join("; ");
    if (detail) {
      return detail;
    }
  }

  const maybeMessage =
    (error as any)?.response?.data?.error?.message ||
    (error as any)?.response?.data?.message ||
    (error as any)?.message;

  if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
    return maybeMessage;
  }

  return fallbackMessage;
}

export function getApiStatusCode(error: unknown): number | null {
  const status = (error as any)?.response?.status;
  return typeof status === "number" ? status : null;
}
