import express from 'express';
import { createMenu, getAllMenu, getMenuId, updateMenu, deleteMenu } from '../Controller/MenuController.js';
import { Authentication, isAdmin } from '../Middleware/Auth.js';

const router = express.Router();

router.post("/create-menu", Authentication, isAdmin, createMenu);
router.get("/getAll-menu", Authentication, getAllMenu);
router.get("/getById-menu/:id", Authentication, getMenuId);
router.put("/update-menu/:id", Authentication, isAdmin, updateMenu);
router.put("/update-menu", Authentication, isAdmin, updateMenu);
router.delete("/delete-menu/:id", Authentication, isAdmin, deleteMenu);

export default router;