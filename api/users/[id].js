// Dynamic /api/users/:id route.
//
// Without this file Vercel has no function to serve /api/users/<id>, so
// PUT/PATCH/DELETE /api/users/106 (edit or delete a user) returned 404. The
// main users handler already parses the id from req.url and dispatches
// GET/PUT/PATCH/DELETE, so we simply delegate to it. Exact-name sibling routes
// (update-status.js, approve.js, …) still take precedence over this dynamic
// route, so they are unaffected.
import handler from './index.js';

export default handler;
