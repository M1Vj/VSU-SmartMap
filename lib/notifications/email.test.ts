import test from "node:test";
import assert from "node:assert/strict";

import { buildGmailRawMessage, sendEmailWithProvider } from "./email.ts";

test("sendEmailWithProvider skips delivery when Resend is not configured", async () => {
  const result = await sendEmailWithProvider({
    apiKey: "",
    from: "",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    message: {
      to: "admin@example.com",
      subject: "Test notification",
      text: "Body",
      html: "<p>Body</p>",
    },
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.provider, "resend");
});

test("sendEmailWithProvider reports successful Resend delivery", async () => {
  const result = await sendEmailWithProvider({
    apiKey: "test-key",
    from: "Campus SmartMap for VSU <noreply@example.com>",
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("Authorization"), "Bearer test-key");
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    },
    message: {
      to: "owner@example.com",
      subject: "Approved",
      text: "Approved",
      html: "<p>Approved</p>",
    },
  });

  assert.equal(result.status, "sent");
  assert.equal(result.providerMessageId, "email_123");
});

test("sendEmailWithProvider reports failed Resend delivery without throwing", async () => {
  const result = await sendEmailWithProvider({
    apiKey: "test-key",
    from: "Campus SmartMap for VSU <noreply@example.com>",
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "bad request" }), { status: 400 }),
    message: {
      to: "owner@example.com",
      subject: "Approved",
      text: "Approved",
      html: "<p>Approved</p>",
    },
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /bad request/);
});

test("sendEmailWithProvider skips Gmail when OAuth credentials are missing", async () => {
  const result = await sendEmailWithProvider({
    provider: "gmail",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRefreshToken: "",
    gmailFrom: "",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    message: {
      to: "admin@example.com",
      subject: "Test notification",
      text: "Body",
      html: "<p>Body</p>",
    },
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.provider, "gmail");
});

test("sendEmailWithProvider sends through Gmail API with a refreshed access token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await sendEmailWithProvider({
    provider: "gmail",
    gmailClientId: "client-id",
    gmailClientSecret: "client-secret",
    gmailRefreshToken: "refresh-token",
    gmailFrom: "Campus SmartMap for VSU <smartmap@example.com>",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url) === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer access-token");
      const body = JSON.parse(String(init?.body)) as { raw?: string };
      assert.equal(typeof body.raw, "string");
      assert.ok(body.raw && !/[+/=]/.test(body.raw));
      return new Response(JSON.stringify({ id: "gmail_123" }), { status: 200 });
    },
    message: {
      to: "owner@example.com",
      subject: "Approved",
      text: "Approved",
      html: "<p>Approved</p>",
    },
  });

  assert.equal(result.status, "sent");
  assert.equal(result.provider, "gmail");
  assert.equal(result.providerMessageId, "gmail_123");
  assert.equal(calls.length, 2);
});

test("buildGmailRawMessage creates a base64url encoded MIME message", () => {
  const raw = buildGmailRawMessage({
    from: "Campus SmartMap for VSU <smartmap@example.com>",
    message: {
      to: "owner@example.com",
      subject: "Approved",
      text: "Approved",
      html: "<p>Approved</p>",
    },
  });

  assert.ok(!/[+/=]/.test(raw));
  const decoded = Buffer.from(raw.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString(
    "utf8",
  );
  assert.match(decoded, /From: Campus SmartMap for VSU <smartmap@example.com>/);
  assert.match(decoded, /To: owner@example.com/);
  assert.match(decoded, /Subject: Approved/);
  assert.match(decoded, /Content-Type: multipart\/alternative/);
});
