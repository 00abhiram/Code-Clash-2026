import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // If there's an error in the URL (from Supabase or OAuth provider), redirect with it
  const urlError = searchParams.get("error");
  const urlErrorDescription = searchParams.get("error_description");
  if (urlError) {
    const message = encodeURIComponent(urlErrorDescription || urlError);
    return NextResponse.redirect(`${origin}/login?error=${message}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // OAuth code exchange failed — redirect to login with error
      const message = encodeURIComponent(error.message);
      return NextResponse.redirect(`${origin}/login?error=${message}`);
    }

    // Check user role to determine redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // Profile not found — trigger may have failed. Redirect to onboarding.
        return NextResponse.redirect(`${origin}/dashboard/onboarding`);
      }

      const redirectPath = profile.role === "admin" ? "/admin" : next;
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code and no error — invalid callback
  return NextResponse.redirect(`${origin}/login?error=No+authorization+code+received`);
}
