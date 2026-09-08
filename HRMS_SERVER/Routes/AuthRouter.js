import express from "express";
import { registerOwner, login, getAuthContext } from "../Controller/UserController.js";
import { Authentication } from "../Middleware/Auth.js";

const router = express.Router();

// One-time Initial Owner Registration Endpoint (Secured by X-HRMS-Setup-Key header)
router.post("/register-owner", registerOwner);

// Standard Login Endpoint
router.post("/login", login);

// Current Authenticated Session & RBAC Access Context (Role, Menus, Permissions)
router.get("/me", Authentication, getAuthContext);

export default router;
