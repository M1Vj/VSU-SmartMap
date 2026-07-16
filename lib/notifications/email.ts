export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailDeliveryResult = {
  status: "sent" | "skipped" | "failed";
  provider: EmailProvider;
  providerMessageId?: string;
  errorMessage?: string;
};

export type EmailProvider = "resend" | "gmail";

type ResendResponse = {
  id?: string;
  message?: string;
  error?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GmailSendResponse = {
  id?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

type SendEmailOptions = {
  provider?: EmailProvider;
  apiKey?: string;
  from?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  gmailFrom?: string;
  message: EmailMessage;
  fetchImpl?: typeof fetch;
};

export async function sendEmailWithProvider({
  provider,
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.EMAIL_FROM,
  gmailClientId = process.env.GMAIL_CLIENT_ID,
  gmailClientSecret = process.env.GMAIL_CLIENT_SECRET,
  gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN,
  gmailFrom = process.env.GMAIL_FROM ?? process.env.EMAIL_FROM,
  message,
  fetchImpl = fetch,
}: SendEmailOptions): Promise<EmailDeliveryResult> {
  const selectedProvider = provider ?? resolveEmailProvider({
    gmailClientId,
    gmailClientSecret,
    gmailRefreshToken,
    gmailFrom,
    apiKey,
    from,
  });

  if (selectedProvider === "gmail") {
    return sendWithGmail({
      clientId: gmailClientId,
      clientSecret: gmailClientSecret,
      refreshToken: gmailRefreshToken,
      from: gmailFrom,
      message,
      fetchImpl,
    });
  }

  return sendWithResend({ apiKey, from, message, fetchImpl });
}

function resolveEmailProvider({
  gmailClientId,
  gmailClientSecret,
  gmailRefreshToken,
  gmailFrom,
  apiKey,
  from,
}: {
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  gmailFrom?: string;
  apiKey?: string;
  from?: string;
}): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "gmail" || process.env.EMAIL_PROVIDER === "resend") {
    return process.env.EMAIL_PROVIDER;
  }
  if (gmailClientId && gmailClientSecret && gmailRefreshToken && gmailFrom) return "gmail";
  if (apiKey && from) return "resend";
  return "resend";
}

async function sendWithResend({
  apiKey,
  from,
  message,
  fetchImpl,
}: {
  apiKey?: string;
  from?: string;
  message: EmailMessage;
  fetchImpl: typeof fetch;
}): Promise<EmailDeliveryResult> {
  if (!apiKey || !from) {
    return {
      status: "skipped",
      provider: "resend",
      errorMessage: "Email delivery skipped because RESEND_API_KEY or EMAIL_FROM is not configured.",
    };
  }

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;
    if (!response.ok) {
      return {
        status: "failed",
        provider: "resend",
        errorMessage:
          payload.message ?? payload.error ?? `Resend returned HTTP ${response.status}.`,
      };
    }

    return {
      status: "sent",
      provider: "resend",
      providerMessageId: payload.id,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      errorMessage: error instanceof Error ? error.message : "Email delivery failed.",
    };
  }
}

async function sendWithGmail({
  clientId,
  clientSecret,
  refreshToken,
  from,
  message,
  fetchImpl,
}: {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  from?: string;
  message: EmailMessage;
  fetchImpl: typeof fetch;
}): Promise<EmailDeliveryResult> {
  if (!clientId || !clientSecret || !refreshToken || !from) {
    return {
      status: "skipped",
      provider: "gmail",
      errorMessage:
        "Email delivery skipped because GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or GMAIL_FROM is not configured.",
    };
  }

  const tokenResult = await refreshGmailAccessToken({
    clientId,
    clientSecret,
    refreshToken,
    fetchImpl,
  });
  if (!tokenResult.accessToken) {
    return {
      status: "failed",
      provider: "gmail",
      errorMessage: tokenResult.errorMessage,
    };
  }

  try {
    const response = await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: buildGmailRawMessage({ from, message }),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as GmailSendResponse;

    if (!response.ok) {
      return {
        status: "failed",
        provider: "gmail",
        errorMessage:
          payload.error?.message ??
          payload.message ??
          `Gmail API returned HTTP ${response.status}.`,
      };
    }

    return {
      status: "sent",
      provider: "gmail",
      providerMessageId: payload.id,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "gmail",
      errorMessage: error instanceof Error ? error.message : "Gmail API delivery failed.",
    };
  }
}

async function refreshGmailAccessToken({
  clientId,
  clientSecret,
  refreshToken,
  fetchImpl,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl: typeof fetch;
}): Promise<{ accessToken?: string; errorMessage?: string }> {
  try {
    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

    if (!response.ok || !payload.access_token) {
      return {
        errorMessage:
          payload.error_description ??
          payload.error ??
          `Google OAuth token endpoint returned HTTP ${response.status}.`,
      };
    }

    return { accessToken: payload.access_token };
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : "Could not refresh Gmail access token.",
    };
  }
}

export function buildGmailRawMessage({
  from,
  message,
}: {
  from: string;
  message: EmailMessage;
}): string {
  const boundary = "vsu-smartmap-notification";
  const mime = [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(message.to)}`,
    `Subject: ${sanitizeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeBody(message.text),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeBody(message.html),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(mime, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function normalizeBody(value: string): string {
  return value.replace(/\r?\n/g, "\r\n");
}
