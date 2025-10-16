// Cloudflare Worker - API Proxy for Foresight Analyzer
// Proxies HTTPS requests to HTTP backend on OCI

const BACKEND_URL = 'http://130.61.137.77:8001';

export default {
  async fetch(request) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // Parse request URL
      const url = new URL(request.url);

      // Build backend URL
      const backendUrl = BACKEND_URL + url.pathname + url.search;

      // Copy headers but remove host header to avoid conflicts
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('cf-connecting-ip');
      headers.delete('cf-ray');
      headers.delete('cf-visitor');

      // Forward request to backend
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // Get response from backend (bypass Cloudflare proxy)
      const backendResponse = await fetch(backendRequest, {
        cf: { cacheTtl: 0 }
      });

      // Create new response with CORS headers
      const response = new Response(backendResponse.body, backendResponse);

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return response;

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Backend unreachable',
        message: error.message
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
