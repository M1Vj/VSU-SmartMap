'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUserRoles } from '@/lib/auth/server';
import { canAccessAdminArea } from '@/lib/auth/roles';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Unable to sign in.' };
  }

  const roles = await getCurrentUserRoles(data.user.id, supabase);
  if (!canAccessAdminArea(roles)) {
    await supabase.auth.signOut();
    return {
      error: 'This account is signed in, but it is not authorized for the admin console.',
    };
  }

  redirect('/admin');
}
