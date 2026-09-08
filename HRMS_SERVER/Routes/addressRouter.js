import express from "express";
import {
  createAddress,
  getAddressByUser,
  updateAddress,
  deleteAddress
} from "../Controller/AddressController.js";

const router = express.Router();

// Create Address
router.post("/create", createAddress);

// Get Address by User / Employee
router.get("/get", getAddressByUser);
router.get("/get/:userId", getAddressByUser);
router.get("/user/:userId", getAddressByUser);
router.get("/employee/:employeeId", getAddressByUser);

// Update / Delete
router.put("/update/:id", updateAddress);
router.delete("/delete/:id", deleteAddress);

export default router;
