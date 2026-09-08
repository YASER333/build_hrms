import express from "express";
import {
  createDocument,
  getDocumentByUser,
  getAllDocuments,
  updateDocumentByUser,
  deleteDocumentByUser,
} from "../Controller/DocumentController.js";

const router = express.Router();

router.post("/create", createDocument);

router.get("/all", getAllDocuments);

router.get("/user/:userId", getDocumentByUser);

router.put("/update/:userId", updateDocumentByUser);

router.delete("/delete/:userId", deleteDocumentByUser);

export default router;
