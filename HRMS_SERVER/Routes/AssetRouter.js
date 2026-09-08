import express from "express";
import {
  createAsset,
  assignAsset,
  returnAsset,
  getAssets,
} from "../Controller/AssetController.js";
import { Authentication, requirePermission } from "../Middleware/Auth.js";

const router = express.Router();

router.use(Authentication);

router.post("/create", requirePermission("asset.create"), createAsset);
router.post("/assign", requirePermission("asset.assign"), assignAsset);
router.put("/:assetId/return", requirePermission("asset.return"), returnAsset);
router.get("/all", requirePermission("asset.read"), getAssets);

export default router;
