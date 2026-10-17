// Explicit /api/auth/login route. Same handler as POST /api/auth — this file
// used to be a stale copy that matched email only and never learned username
// sign-in, so the two routes behaved differently.
export { default } from './index.js';
