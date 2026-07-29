import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { oauthFailurePath, safeOauthNext } from "@/lib/auth/oauth-return";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function redirectWithCookies(path: string, pendingCookies: PendingCookie[]) {
  const response = new NextResponse(null, {
    status: 307,
    headers: { location: path },
  });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeOauthNext(searchParams.get("next"));
  const failurePath = oauthFailurePath(next);

  if (!code) return redirectWithCookies(failurePath, []);

  const pendingCookies: PendingCookie[] = [];
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return redirectWithCookies(error ? failurePath : next, pendingCookies);
  } catch {
    try {
      return redirectWithCookies(failurePath, pendingCookies);
    } catch {
      return redirectWithCookies(failurePath, []);
    }
  }
}
