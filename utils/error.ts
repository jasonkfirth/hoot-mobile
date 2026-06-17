export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message || "Unknown error";

  if (error && typeof error === "object") {
    if (typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }

    return JSON.stringify(error);
  }

  if (error === undefined) return "Unknown error";

  return `${error}`;
}
