export function toMinorAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive USD value");
  }
  const cents = Math.round(amount * 100);
  if (cents <= 0 || cents > 99_999_999) {
    throw new Error("Amount is outside the supported range");
  }
  return String(cents);
}

export function createTransactionReference(now = Date.now()): string {
  const raw = now.toString(36).toUpperCase();
  return `P${raw}`.slice(0, 20);
}

const NOT_REGISTERED =
  "This sandbox API user is not registered for PaymentTokenization. Enable that scope on the sandbox merchant key, then retry.";

export function readAccessDenial(
  payload: unknown,
): { responseCode: string; responseMessage: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const errors = (payload as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return null;

  for (const error of errors) {
    if (!error || typeof error !== "object") continue;
    const record = error as Record<string, unknown>;
    const field = typeof record.field === "string" ? record.field : "";
    const message = typeof record.message === "string" ? record.message : "";
    if (
      field === "MTERR_009"
      || /not registered for PaymentTokenization/i.test(message)
    ) {
      return { responseCode: field || "MTERR_009", responseMessage: NOT_REGISTERED };
    }
  }

  return null;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9]{1,20}$/;

export function assertTransactionReference(value: string): string {
  if (!REFERENCE_PATTERN.test(value)) {
    throw new Error(
      "transactionReferenceId must be 1-20 letters or digits",
    );
  }
  return value;
}
