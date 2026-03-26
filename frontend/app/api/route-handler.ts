// API Route Handler - Proxy para o Backend Cloudflare Workers
// Usar em: app/api/[...path]/route.ts

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api/v1';

export async function apiProxy(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BACKEND_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

export async function GET(request: Request, { params }: any) {
  const { path } = params;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  const response = await apiProxy('GET', `/${path.join('/')}`, undefined, token);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function POST(request: Request, { params }: any) {
  const { path } = params;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const body = await request.json();

  const response = await apiProxy('POST', `/${path.join('/')}`, body, token);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function PUT(request: Request, { params }: any) {
  const { path } = params;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const body = await request.json();

  const response = await apiProxy('PUT', `/${path.join('/')}`, body, token);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function DELETE(request: Request, { params }: any) {
  const { path } = params;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  const response = await apiProxy('DELETE', `/${path.join('/')}`, undefined, token);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
