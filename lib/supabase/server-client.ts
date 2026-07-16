import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serviceClient: SupabaseClient | null = null;

export const getSupabaseServerClient = async () => {
  const cookieStoreMaybePromise = cookies();
  const cookieStore =
    cookieStoreMaybePromise instanceof Promise
      ? await cookieStoreMaybePromise
      : cookieStoreMaybePromise;

  if (!url || !anonKey) {
    return createServerClient("http://localhost:3000", "placeholder", {
        cookies: { getAll() { return []; }, setAll() {} }
    });
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            (cookieStore as any).set?.(name, value, options);
          });
        } catch {
        }
      },
    },
  });
};

export const getSupabaseServiceRoleClient = () => {
  if (serviceClient) return serviceClient;
  
  if (!url || !serviceRoleKey) {
     return createSupabaseClient("http://localhost:3000", "placeholder");
  }

  serviceClient = createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return serviceClient;
};

export const getSupabaseAdminClient = async (options?: { requireServiceRole?: boolean }) => {
  try {
    return { client: getSupabaseServiceRoleClient(), isServiceRole: true };
  } catch (error) {
    console.error("[getSupabaseAdminClient] Service role client unavailable:", error instanceof Error ? error.message : error);
    if (options?.requireServiceRole) {
      throw error;
    }
    const client = await getSupabaseServerClient();
    return { client, isServiceRole: false };
  }
};
