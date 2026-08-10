/** Every interactive action buzzes. Unsupported browsers fail silently. */
export function buzz(pattern: number | readonly number[]): void {
  try {
    navigator.vibrate?.(pattern as number | number[]);
  } catch {
    // No vibration motor, or a browser that refuses. Not worth reporting.
  }
}
