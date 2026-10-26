// Mobile numbers are 10 digits (India), entered without +91 or a leading 0. Used by the browser
// forms and the server, so both apply the same rule.

export const MOBILE_DIGITS = 10;
export const MOBILE_ERROR = "Enter a 10-digit mobile number.";

/** What a mobile number box keeps as you type or paste: digits only, at most 10. */
export function mobileInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Pasted with the country code or a leading 0: "+91 98765 43210", "098765 43210".
  if (value.trim().startsWith("+91") || /^91\d{10}$/.test(digits) || /^0\d{10}$/.test(digits)) digits = digits.slice(-MOBILE_DIGITS);
  return digits.slice(0, MOBILE_DIGITS);
}

export const isMobile = (value: string) => /^\d{10}$/.test(value);

/** The last 10 digits, for comparing numbers saved before this rule (e.g. "+91 98765 43210"). */
export const last10 = (value: string) => value.replace(/\D/g, "").slice(-MOBILE_DIGITS);
