import "server-only";

// PayFast settings from server-only env vars. Payments are switched OFF
// (the app shows "Upgrades coming soon") unless the merchant id and key are
// set. PAYFAST_SANDBOX=true points at PayFast's sandbox.
//
// PAYFAST_SKIP_REMOTE_CHECKS=true skips the call back to PayFast and the
// source-IP check on ITNs — only so local tests can simulate a notification.
// It is ignored in production builds.

export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string | null;
  sandbox: boolean;
  processUrl: string;
  validateUrl: string;
  validHosts: string[];
  skipRemoteChecks: boolean;
};

export function payfastConfig(): PayfastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim();
  if (!merchantId || !merchantKey) return null;
  const sandbox = process.env.PAYFAST_SANDBOX === "true";
  const host = sandbox ? "sandbox.payfast.co.za" : "www.payfast.co.za";
  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE?.trim() || null,
    sandbox,
    processUrl: `https://${host}/eng/process`,
    validateUrl: `https://${host}/eng/query/validate`,
    validHosts: ["www.payfast.co.za", "sandbox.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za"],
    skipRemoteChecks: process.env.PAYFAST_SKIP_REMOTE_CHECKS === "true" && process.env.NODE_ENV !== "production",
  };
}

/** Guest-cap enforcement (PRICING.md: "a new contributor beyond the cap gets
 * 'This album is full'"). Off until pricing launches. */
export function planLimitsEnforced(): boolean {
  return process.env.PLAN_LIMITS_ENFORCED === "true";
}
