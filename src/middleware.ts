import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * Lightweight edge telemetry for page requests.
 *
 * API routes are instrumented in `src/lib/api.ts` (apiHandler), where the real
 * response status and full handler latency are known. This middleware covers
 * the remaining page requests without logging headers, query strings, bodies,
 * cookies or any other user data.
 */
export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const started = Date.now();
  const response = NextResponse.next();

  event.waitUntil(
    Promise.resolve().then(() => {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "page.request",
          method: request.method,
          route: pathname.replace(/\/[A-Za-z0-9_-]{24,}/g, "/:id"),
          status: response.status,
          latencyMs: Date.now() - started,
          timestamp: new Date().toISOString(),
        })
      );
    })
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
