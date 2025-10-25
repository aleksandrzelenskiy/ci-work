import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, req) => {
  await auth.protect();
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/org\/([^/]+)/);
  if (m) {
    const res = NextResponse.next();
    res.headers.set('x-org-slug', m[1]);
    return res;
  }
});
export const config = { matcher: ['/((?!_next|.*\\..*|api/webhooks).*)'] };
