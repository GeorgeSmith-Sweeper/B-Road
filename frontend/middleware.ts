import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/my-routes(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Only run middleware on routes that need auth
    '/my-routes(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/(api|trpc)(.*)',
  ],
};
