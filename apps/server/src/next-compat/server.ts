/**
 * Minimal `next/server` for running zdocs' App Router route handlers on Hono.
 * Only what the copied handlers use: NextResponse.json/redirect and NextRequest.
 */
export class NextRequest extends Request {
  get nextUrl(): URL {
    return new URL(this.url);
  }
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }

  static redirect(url: string | URL, status = 307): NextResponse {
    return new NextResponse(null, { status, headers: { location: String(url) } });
  }
}
