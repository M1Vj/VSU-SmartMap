import { updateSession } from "@/lib/supabase/middleware";
import { NextRequest } from "next/server";

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.geoapify.com https://api.openrouteservice.org https://routing.openstreetmap.de",
    "frame-src https://challenges.cloudflare.com",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(headers: Headers, nonce: string): void {
  headers.set("content-security-policy", buildContentSecurityPolicy(nonce));
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set(
    "permissions-policy",
    "camera=(), geolocation=(self), microphone=(), payment=(), usb=()",
  );
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
}

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  // Next.js reads the nonce for its inline bootstrap and flight scripts from
  // the request's CSP header, so the renderer and the response share one
  // per-request value.
  applySecurityHeaders(headers, nonce);
  const forwardedRequest = new NextRequest(request, { headers });
  const response = await updateSession(forwardedRequest);
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers, nonce);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
