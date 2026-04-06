import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
                headers: request.headers,
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
                headers: request.headers,
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
    const pathname = request.nextUrl.pathname

    // Protect /dashboard routes
    if (pathname.startsWith('/dashboard') && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
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
    if (user && !pathname.startsWith('/api/')) {
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

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
