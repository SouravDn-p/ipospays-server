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

const REFERENCE_PATTERN = /^[A-Za-z0-9]{1,20}$/;

export function assertTransactionReference(value: string): string {
  if (!REFERENCE_PATTERN.test(value)) {
    throw new Error(
      "transactionReferenceId must be 1-20 letters or digits",
    );
  }
  return value;
}
