"use server";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEST_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; error?: string }> {
  const secretKey =
    process.env.NODE_ENV !== "production"
      ? TEST_TURNSTILE_SECRET_KEY
      : process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return { success: false, error: "Captcha verification is unavailable" };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    if (idempotencyKey) {
      params.append("idempotency_key", idempotencyKey);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const data: TurnstileVerifyResponse = await response.json();

    if (!data.success) {
      const errorCodes = data["error-codes"]?.join(", ") || "Unknown error";
      console.error("Turnstile verification failed:", errorCodes);
      return { success: false, error: `Captcha verification failed: ${errorCodes}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { success: false, error: "Failed to verify captcha" };
  }
}
