import express from "express";
import {
  createFamily,
  addFamilyMember,
  getFamilyByUserId,
  getAllFamilyMembers,
  getFamilyById,
  updateFamily,
  updateFamilyMember,
  deleteFamilyMember,
  deleteFamily,
  verifyFamily,
} from "../Controller/FamilyController.js";

const router = express.Router();

// ===== CREATE / INITIALIZE FAMILY RECORD =====
router.post("/", createFamily);
router.post("/create", createFamily);

// ===== ADD SINGLE FAMILY MEMBER (OR AUTO-INITIALIZE) =====
router.post("/member", addFamilyMember);
router.post("/add", (req, res) => {
  // If array or full family object is passed to /add, call createFamily, otherwise addFamilyMember
  if (Array.isArray(req.body.familyMembers) || (!req.body.name && req.body.familyMembers)) {
    return createFamily(req, res);
  }
  return addFamilyMember(req, res);
});
router.post("/:userId/member", addFamilyMember);

// ===== GET ALL FAMILY RECORDS =====
router.get("/", getAllFamilyMembers);
router.get("/getAll", getAllFamilyMembers);
router.get("/all", getAllFamilyMembers);

// ===== GET FAMILY RECORD BY ID =====
router.get("/detail/:id", getFamilyById);
router.get("/id/:id", getFamilyById);

// ===== GET FAMILY RECORD BY USER ID =====
router.get("/get/:userId", getFamilyByUserId);
router.get("/user/:userId", getFamilyByUserId);
router.get("/:userId", getFamilyByUserId);

// ===== UPDATE FULL FAMILY RECORD =====
router.put("/", updateFamily);
router.put("/update", updateFamily);
router.put("/:userId", updateFamily);

// ===== UPDATE SPECIFIC FAMILY MEMBER =====
router.put("/member/:memberId", updateFamilyMember);
router.put("/:userId/member/:memberId", updateFamilyMember);

// ===== DELETE SPECIFIC FAMILY MEMBER =====
router.delete("/member/:memberId", deleteFamilyMember);
router.delete("/:userId/member/:memberId", deleteFamilyMember);

// ===== DELETE FULL FAMILY RECORD =====
router.delete("/delete", deleteFamily);
router.delete("/delete/:userId", deleteFamily);
router.delete("/:userId", deleteFamily);

// ===== VERIFY FAMILY RECORD (HR / Admin) =====
router.patch("/verify/:userId", verifyFamily);
router.put("/verify/:userId", verifyFamily);

export default router;
