import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: '/:path*',
};

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const response = NextResponse.next();
  
  // Adicionar header para detectar .pages.dev no cliente
  if (hostname.includes('.pages.dev')) {
    response.headers.set('X-Pages-Dev-Domain', 'true');
  }
  
  // Redirecionar www para apex domain
  if (hostname === 'www.framevideos.com') {
    const url = request.nextUrl.clone();
    url.host = 'framevideos.com';
    return NextResponse.redirect(url, 301);
  }
  
  // Adicionar canonical URL header
  response.headers.set('X-Canonical-URL', `https://framevideos.com${request.nextUrl.pathname}`);
  
  return response;
}
