import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware";
import { asyncHandler } from "../../middlewares/errorsMiddleware";
import {
  getClientByIdController,
  getClientsController,
} from "./client.controller";

export const router = Router();

// Lists every user's profile (with email): admins only. The user app reads its own profile
// from GET /api/auth/me
router.get(
  "/",
  asyncHandler(authMiddleware),
  requireRole("admin"),
  asyncHandler(async (req, res) => getClientsController(req, res))
);
router.get(
  "/:id",
  asyncHandler(authMiddleware),
  requireRole("admin"),
  asyncHandler(async (req, res) => getClientByIdController(req, res))
);
