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

    if (pathname.startsWith('/dashboard') && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Onboarding redirect: if authenticated + accessing dashboard + no company_name + not already on onboarding
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
