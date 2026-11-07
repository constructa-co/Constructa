import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getLaunchProfile, getLaunchRedirectPath, isDashboardPathAllowed } from '@/lib/launch-profile'
import { reviewEnabled, reviewPageAllowed, REVIEW_CSP, REVIEW_USER } from '@/lib/deployment/review-policy'
import { editableReview, editablePage } from '@/lib/deployment/review-editable'
import { forgotPasswordExpiredUrl, shouldRedirectRecoveryLinkFailure } from '@/lib/auth-recovery-link-failure'

export async function proxy(request: NextRequest) {
  const review = reviewEnabled();
  const pathname = request.nextUrl.pathname
  if (
    request.method === 'GET' &&
    shouldRedirectRecoveryLinkFailure(pathname, request.nextUrl.search)
  ) {
    return NextResponse.redirect(new URL(forgotPasswordExpiredUrl(), request.url))
  }
  if (review && !reviewPageAllowed(request.method, request.nextUrl.pathname) && !(editableReview() && editablePage(request.method, request.nextUrl.pathname))) {
    return new NextResponse('This protected review is read-only. Saved data and external actions are disabled.', {
      status: 403, headers: { 'Content-Security-Policy': REVIEW_CSP, 'Cache-Control': 'no-store' },
    });
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Check if environment variables are available before initializing Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables are missing. Skipping auth middleware.');
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (review && user && user.id !== REVIEW_USER) {
      return new NextResponse('Only the existing labelled test account is available in this review.', { status: 403 });
    }
    // Protect /dashboard routes
    if (pathname.startsWith('/dashboard') && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Cohort launches expose only the work-winning journey. This server-side
    // gate prevents copied URLs from bypassing the same profile used by nav.
    if (user && pathname.startsWith('/dashboard') && !isDashboardPathAllowed(pathname, getLaunchProfile())) {
      const redirectUrl = new URL(getLaunchRedirectPath(), request.url)
      redirectUrl.searchParams.set('notice', 'module-unavailable')
      return NextResponse.redirect(redirectUrl)
    }

    // Protect /admin routes — must be authenticated (email check happens in layout)
    if (pathname.startsWith('/admin') && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Onboarding redirect: if authenticated + accessing dashboard + no company_name + not already on onboarding
    // Skip for /admin routes so admin doesn't get caught in onboarding loop
    if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/onboarding')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', user.id)
        .single()

      if (!profile?.company_name) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }

    // Country capture: if user is authenticated and on any route, try to update country in profiles
    // CF-IPCountry or x-vercel-ip-country header is set by Vercel edge network
    if (!review && user && !pathname.startsWith('/api/')) {
        const country = request.headers.get('x-vercel-ip-country') ||
                        request.headers.get('cf-ipcountry') ||
                        null;
        if (country && country !== 'XX') { // XX = unknown
            // Fire-and-forget: update country if not already set
            // Use the anon client (user is authenticated) — only update if country IS NULL
            supabase.from('profiles')
                .update({ country })
                .eq('id', user.id)
                .is('country', null)
                .then(() => {}) // deliberately ignore result to not block request
        }
    }
  } catch (error) {
    console.error('Middleware Supabase error:', error);
  }

  if (review) {
    response.headers.set('Content-Security-Policy', REVIEW_CSP);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
