import mongoose from "mongoose";
import Address from "../Modules/AddressModule.js";
import pincodeLookup from "india-pincode-lookup";

export const createAddress = async (req, res) => {
  try {
    const {
      addressType,
      address1,
      address2,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
      userId,
      employeeId
    } = req.body;

    const targetUserId = userId || employeeId || req.user?.id;
    if (!targetUserId) {
      return res.status(400).json({ message: "userId or employeeId is required" });
    }

    const finalAddressType = addressType || "Permanent";
    const line1 = address1 || addressLine1 || "";
    const line2 = address2 || addressLine2 || "";
    const pinVal = String(pincode || "").trim();

    let finalCity = city || "";
    let finalState = state || "";

    // Pincode lookup to auto-fill city/state if provided
    if (pinVal && pinVal.length === 6) {
      try {
        const pincodeData = pincodeLookup.lookup(pinVal);
        if (pincodeData && pincodeData.length > 0) {
          finalCity = finalCity || pincodeData[0].districtName;
          finalState = finalState || pincodeData[0].stateName;
        }
      } catch (pinErr) {
        console.warn("pincodeLookup notice:", pinErr.message);
      }
    }

    const newAddress = new Address({
      userId: targetUserId,
      addressType: finalAddressType,
      address1: line1 || "Address Line 1",
      address2: line2,
      city: finalCity || "City",
      state: finalState || "State",
      country: country || "India",
      pincode: pinVal || "600001"
    });

    const savedAddress = await newAddress.save();

    res.status(201).json({
      message: "Address added successfully",
      data: {
        _id: savedAddress._id,
        id: savedAddress._id,
        userId: savedAddress.userId,
        addressType: savedAddress.addressType,
        address1: savedAddress.address1,
        addressLine1: savedAddress.address1,
        address2: savedAddress.address2,
        addressLine2: savedAddress.address2,
        city: savedAddress.city,
        state: savedAddress.state,
        country: savedAddress.country,
        pincode: savedAddress.pincode
      }
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const pinVal = String(req.body.pincode || "").trim();
    if (pinVal && pinVal.length === 6) {
      try {
        const pincodeData = pincodeLookup.lookup(pinVal);
        if (pincodeData && pincodeData.length > 0) {
          req.body.city = req.body.city || pincodeData[0].districtName;
          req.body.state = req.body.state || pincodeData[0].stateName;
          req.body.country = "India";
        }
      } catch (pinErr) {
        console.warn("pincodeLookup notice:", pinErr.message);
      }
    }

    if (req.body.addressLine1 && !req.body.address1) {
      req.body.address1 = req.body.addressLine1;
    }
    if (req.body.addressLine2 && !req.body.address2) {
      req.body.address2 = req.body.addressLine2;
    }

    const updated = await Address.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: "Address updated successfully", data: updated });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getAddressByUser = async (req, res) => {
  try {
    const targetUserId =
      req.params.userId ||
      req.params.employeeId ||
      req.query.userId ||
      req.query.employeeId ||
      req.user?.id;

    if (!targetUserId) {
      return res.status(200).json({ data: [], addresses: [] });
    }

    let query = { userId: targetUserId };
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      const objId = new mongoose.Types.ObjectId(targetUserId);
      query = {
        $or: [
          { userId: targetUserId },
          { userId: objId },
          { employeeId: targetUserId },
          { employeeId: objId },
        ],
      };
    }

    const addresses = await Address.find(query).sort({ createdAt: -1 });

    const mapped = addresses.map((a) => ({
      _id: a._id,
      id: a._id,
      userId: a.userId,
      addressType: a.addressType || "Permanent",
      address1: a.address1,
      addressLine1: a.address1,
      address2: a.address2 || "",
      addressLine2: a.address2 || "",
      city: a.city,
      state: a.state,
      country: a.country || "India",
      pincode: a.pincode,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    res.status(200).json({ data: mapped, addresses: mapped });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    await Address.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
