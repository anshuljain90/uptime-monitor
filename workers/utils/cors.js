// CORS utilities for API responses

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

export function handleCORS(request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
      ...additionalHeaders
    }
  });
}

export function errorResponse(message, status = 400, code = 'ERROR') {
  return jsonResponse({
    error: true,
    code,
    message
  }, status);
}
