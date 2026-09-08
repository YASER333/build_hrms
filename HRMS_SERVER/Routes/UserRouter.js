import express from "express";
import {
  register,
  registerOwner,
  login,
  logout,
  profile,
  updateUser,
  getAllUser,
  getUserById,
  updateUserRole,
  deleteUser,
  provisionAccount,
  updateAccountStatus,
  resetAccountCredentials,
  uploadProfilePicture,
} from "../Controller/UserController.js";
import {
  Authentication,
  isAdmin,
  requirePermission,
  requireOwnershipOrPermission,
} from "../Middleware/Auth.js";
import { uploadMiddleware } from "../Services/UploadService.js";

const router = express.Router();

// ── Public Routes ──
router.post("/register", uploadMiddleware.any(), register);
router.post("/register-owner", registerOwner);
router.post("/login", login);

// ── Authenticated Self / Session Routes ──
router.post("/logout", Authentication, logout);
router.get("/profile", Authentication, profile);
router.put("/v2/update", Authentication, uploadMiddleware.any(), updateUser);
router.post("/upload-profile-pic", Authentication, uploadMiddleware.any(), uploadProfilePicture);
router.post("/v2/upload-profile-pic", Authentication, uploadMiddleware.any(), uploadProfilePicture);
router.post("/:id/upload-profile-pic", Authentication, uploadMiddleware.any(), uploadProfilePicture);


// ── User Management & Directory (RBAC Protected) ──
router.get("/get", Authentication, requirePermission("user.read"), getAllUser);
router.get(
  "/v2/getbyid/:id",
  Authentication,
  requireOwnershipOrPermission("id", "user.read_own", "user.read"),
  getUserById
);

// ── Account Provisioning & Lifecycle Management ──
router.post(
  "/provision-account",
  Authentication,
  requirePermission("user.provision_account"),
  provisionAccount
);
router.put(
  "/account-status/:id",
  Authentication,
  requirePermission("user.manage_status"),
  updateAccountStatus
);
router.put(
  "/reset-credentials/:id",
  Authentication,
  requirePermission("user.manage_status"),
  resetAccountCredentials
);

// ── Role Assignment & User Deletion ──
router.put(
  "/v2/updateRole/:id",
  Authentication,
  requirePermission("user.manage_roles"),
  updateUserRole
);
router.delete(
  "/v2/deleteUser/:id",
  Authentication,
  isAdmin,
  deleteUser
);
router.delete(
  "/v2/deleteUser",
  Authentication,
  isAdmin,
  deleteUser
);

export default router;