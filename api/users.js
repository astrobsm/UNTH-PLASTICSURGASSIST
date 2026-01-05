// Simplified users endpoint to debug the 500 error
import bcrypt from "bcryptjs";
import { query } from "./_lib/db.js";
import { cors, authenticateRequest } from "./_lib/auth.js";

export default async function handler(req, res) {
  // Basic CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Authenticate
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    // Only GET is supported in this simplified version
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed in simplified mode" });
    }

    // Check role
    if (!["admin", "consultant"].includes(auth.user.role)) {
      return res.status(403).json({ 
        error: "Access denied", 
        yourRole: auth.user.role,
        requiredRoles: ["admin", "consultant"]
      });
    }

    // Query database
    const result = await query(
      "SELECT id, username, email, full_name, role, is_approved, is_active, created_at, last_login FROM users ORDER BY created_at DESC"
    );

    return res.status(200).json({ users: result.rows });

  } catch (error) {
    console.error("Users API Error:", error);
    return res.status(500).json({ 
      error: "Server error", 
      message: error.message 
    });
  }
}
