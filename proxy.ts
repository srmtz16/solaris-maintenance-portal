import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // The administration icon is a public brand asset, including on the login screen.
  if (request.nextUrl.pathname === "/admin/icon.ico") return NextResponse.next();
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const isLogin = request.nextUrl.pathname === "/admin/login";
  const redirect = (destination: URL) => {
    const result = NextResponse.redirect(destination);
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    return result;
  };

  if (!url || !key) {
    return isLogin ? response : redirect(new URL("/admin/login?error=config", request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Ask Auth for the current account; a locally valid JWT can contain a revoked role.
  const { data, error } = await supabase.auth.getUser();
  const appMetadata = !error ? data?.user?.app_metadata : undefined;
  const isAdmin = appMetadata?.role === "admin";
  const isViewer = appMetadata?.role === "viewer";
  const isConsultation = request.nextUrl.pathname === "/consulta";

  if (isViewer && !isConsultation) return redirect(new URL("/consulta", request.url));
  if (isViewer && isConsultation) return response;

  if (!isAdmin && !isLogin) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirect(loginUrl);
  }

  if (isAdmin && isLogin) {
    return redirect(new URL("/admin/documentos", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/consulta"],
};
