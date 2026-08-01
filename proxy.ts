import { updateSession } from "@/lib/supabase/middleware";
import { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const forwardedRequest = new NextRequest(request, { headers });
  const response = await updateSession(forwardedRequest);
  response.headers.set("x-request-id", requestId);
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
