export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
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
