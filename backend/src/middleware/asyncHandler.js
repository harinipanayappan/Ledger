// Express 4 does not forward rejected promises from async handlers to its
// error middleware. Wrap every async route so failures produce a response.
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
