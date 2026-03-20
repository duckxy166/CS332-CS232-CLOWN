const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

function response(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function ok(data, message) {
  const body = { success: true, data };
  if (message) body.message = message;
  return response(200, body);
}

function created(data, message = 'สร้างสำเร็จ') {
  return response(201, { success: true, message, data });
}

function error(statusCode, message) {
  return response(statusCode, { success: false, message });
}

module.exports = { CORS_HEADERS, response, ok, created, error };
