import mongoose from "mongoose";
import Family from "../Modules/FamilyModule.js";
import User from "../Modules/UserModule.js";

// Valid enum definitions
const VALID_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Guardian",
  "Other",
];

const VALID_GENDERS = ["Male", "Female", "Other"];

// Normalization helper for enum values
const normalizeRelationship = (rel) => {
  if (!rel || typeof rel !== "string") return rel;
  const trimmed = rel.trim();
  const matched = VALID_RELATIONSHIPS.find(
    (r) => r.toLowerCase() === trimmed.toLowerCase()
  );
  return matched || trimmed;
};

const normalizeGender = (gender) => {
  if (!gender || typeof gender !== "string") return gender;
  const trimmed = gender.trim();
  const matched = VALID_GENDERS.find(
    (g) => g.toLowerCase() === trimmed.toLowerCase()
  );
  return matched || trimmed;
};

// Validate and format a single family member object
const formatFamilyMember = (member) => {
  if (!member || typeof member !== "object") return null;

  const name = member.name ? String(member.name).trim() : "";
  const relationship = normalizeRelationship(member.relationship);
  const gender = member.gender ? normalizeGender(member.gender) : undefined;
  const occupation = member.occupation ? String(member.occupation).trim() : undefined;
  const phone = member.phone
    ? String(member.phone).trim()
    : member.emergencyContact
    ? String(member.emergencyContact).trim()
    : undefined;
  const email = member.email ? String(member.email).trim().toLowerCase() : undefined;
  const isEmergencyContact =
    member.isEmergencyContact !== undefined
      ? Boolean(member.isEmergencyContact)
      : false;
  const emergencyContactPriority =
    member.emergencyContactPriority !== undefined &&
    member.emergencyContactPriority !== null &&
    member.emergencyContactPriority !== ""
      ? Number(member.emergencyContactPriority)
      : undefined;
  const address = member.address ? String(member.address).trim() : undefined;

  const result = {
    name,
    relationship,
  };

  if (gender) result.gender = gender;
  if (occupation) result.occupation = occupation;
  if (phone) result.phone = phone;
  if (email) result.email = email;
  result.isEmergencyContact = isEmergencyContact;
  if (emergencyContactPriority !== undefined) {
    result.emergencyContactPriority = emergencyContactPriority;
  }
  if (address) result.address = address;
  if (member._id) result._id = member._id;

  return result;
};

// Validate member required fields & enums
const validateMemberFields = (member) => {
  if (!member.name) {
    throw new Error("Member name is required");
  }
  if (!member.relationship) {
    throw new Error("Relationship is required");
  }
  if (!VALID_RELATIONSHIPS.includes(member.relationship)) {
    throw new Error(
      `Invalid relationship '${member.relationship}'. Allowed: ${VALID_RELATIONSHIPS.join(", ")}`
    );
  }
  if (member.gender && !VALID_GENDERS.includes(member.gender)) {
    throw new Error(
      `Invalid gender '${member.gender}'. Allowed: ${VALID_GENDERS.join(", ")}`
    );
  }
  if (
    member.emergencyContactPriority !== undefined &&
    (isNaN(member.emergencyContactPriority) || Number(member.emergencyContactPriority) < 1)
  ) {
    throw new Error("emergencyContactPriority must be a number greater than or equal to 1");
  }
};

/**
 * 1. CREATE / SET FAMILY DETAILS
 * Creates a new family record for a user or initializes family members list
 */
export const createFamily = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId || body.userid || req.params?.userId;
    const { remarks, isVerified, verifiedBy } = body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    // Check if record already exists for this user
    const existing = await Family.findOne({ userId });
    if (existing) {
      return res.status(400).json({
        message: "Family record already exists for this user. Use PUT or POST /member to update.",
        data: existing,
      });
    }

    // Extract familyMembers from body
    let membersInput = body.familyMembers || [];
    if (!Array.isArray(membersInput) && body.name && body.relationship) {
      membersInput = [body];
    } else if (typeof membersInput === "string") {
      try {
        membersInput = JSON.parse(membersInput);
      } catch (e) {
        membersInput = [];
      }
    }

    const formattedMembers = [];
    for (const rawMember of membersInput) {
      const formatted = formatFamilyMember(rawMember);
      if (formatted) {
        validateMemberFields(formatted);
        formattedMembers.push(formatted);
      }
    }

    const family = new Family({
      userId,
      familyMembers: formattedMembers,
      remarks: remarks || undefined,
      isVerified: isVerified || false,
      verifiedBy: verifiedBy || null,
      verifiedAt: isVerified ? new Date() : null,
    });

    const savedFamily = await family.save();
    await savedFamily.populate("userId", "firstName lastName name email employeeCode");

    return res.status(201).json({
      message: "Family created successfully",
      data: savedFamily,
      family: savedFamily,
    });
  } catch (error) {
    console.error("createFamily Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 2. ADD A SINGLE FAMILY MEMBER
 * Appends a new family member to the user's family record (upsert if family record doesn't exist)
 */
export const addFamilyMember = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.params?.userId || body.userId || body.userid;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const memberData = formatFamilyMember(body);
    if (!memberData) {
      return res.status(400).json({ message: "Family member details are required" });
    }

    validateMemberFields(memberData);

    let family = await Family.findOne({ userId });

    if (!family) {
      family = new Family({
        userId,
        familyMembers: [memberData],
      });
      await family.save();
    } else {
      family.familyMembers.push(memberData);
      await family.save();
    }

    await family.populate("userId", "firstName lastName name email employeeCode");

    return res.status(201).json({
      message: "Family member added successfully",
      data: family,
      addedMember: family.familyMembers[family.familyMembers.length - 1],
    });
  } catch (error) {
    console.error("addFamilyMember Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 3. GET FAMILY BY USER ID
 */
export const getFamilyByUserId = async (req, res) => {
  try {
    const userId = req.params?.userId || req.params?.userid || req.query?.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const family = await Family.findOne({ userId })
      .populate("userId", "firstName lastName name email employeeCode mobileNo gender dob")
      .populate("verifiedBy", "firstName lastName name email employeeCode");

    if (!family) {
      return res.status(404).json({
        message: "Family details not found for this user",
        data: null,
      });
    }

    return res.status(200).json({
      message: "Family details fetched successfully",
      data: family,
      familyMembers: family.familyMembers,
    });
  } catch (error) {
    console.error("getFamilyByUserId Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * 4. GET ALL FAMILIES
 */
export const getAllFamilyMembers = async (req, res) => {
  try {
    const families = await Family.find()
      .populate("userId", "firstName lastName name email employeeCode mobileNo")
      .populate("verifiedBy", "firstName lastName name email employeeCode")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Family records retrieved successfully",
      count: families.length,
      data: families,
    });
  } catch (error) {
    console.error("getAllFamilyMembers Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * 5. GET FAMILY BY DOC ID
 */
export const getFamilyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Family ID format" });
    }

    const family = await Family.findById(id)
      .populate("userId", "firstName lastName name email employeeCode")
      .populate("verifiedBy", "firstName lastName name email employeeCode");

    if (!family) {
      return res.status(404).json({ message: "Family record not found" });
    }

    return res.status(200).json({ data: family });
  } catch (error) {
    console.error("getFamilyById Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * 6. UPDATE FULL FAMILY RECORD BY USER ID OR ID
 */
export const updateFamily = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.params?.userId || body.userId || body.userid;
    const { id } = body;

    let query = {};
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query = { userId };
    } else if (id && mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      return res.status(400).json({ message: "Valid userId or document id is required" });
    }

    const existingFamily = await Family.findOne(query);
    if (!existingFamily) {
      return res.status(404).json({ message: "Family record not found" });
    }

    const updatePayload = {};

    if (body.remarks !== undefined) {
      updatePayload.remarks = body.remarks;
    }

    if (body.isVerified !== undefined) {
      updatePayload.isVerified = body.isVerified;
      if (body.isVerified) {
        updatePayload.verifiedAt = new Date();
        if (body.verifiedBy) updatePayload.verifiedBy = body.verifiedBy;
      }
    }

    if (body.familyMembers) {
      let membersInput = body.familyMembers;
      if (typeof membersInput === "string") {
        try {
          membersInput = JSON.parse(membersInput);
        } catch (e) {
          membersInput = [];
        }
      }

      if (Array.isArray(membersInput)) {
        const formattedMembers = [];
        for (const rawMember of membersInput) {
          const formatted = formatFamilyMember(rawMember);
          if (formatted) {
            validateMemberFields(formatted);
            formattedMembers.push(formatted);
          }
        }
        updatePayload.familyMembers = formattedMembers;
      }
    }

    const updatedFamily = await Family.findOneAndUpdate(
      query,
      { $set: updatePayload },
      { new: true, runValidators: true }
    )
      .populate("userId", "firstName lastName name email employeeCode")
      .populate("verifiedBy", "firstName lastName name email employeeCode");

    return res.status(200).json({
      message: "Family updated successfully",
      data: updatedFamily,
    });
  } catch (error) {
    console.error("updateFamily Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 7. UPDATE A SPECIFIC FAMILY MEMBER
 */
export const updateFamilyMember = async (req, res) => {
  try {
    const body = req.body || {};
    const memberId = req.params?.memberId || body.memberId || body.id;
    const userId = req.params?.userId || body.userId || body.userid;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "Valid memberId is required" });
    }

    // Build search query
    let query = { "familyMembers._id": memberId };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    const family = await Family.findOne(query);
    if (!family) {
      return res.status(404).json({ message: "Family member not found" });
    }

    const memberIndex = family.familyMembers.findIndex(
      (m) => m._id.toString() === memberId.toString()
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Family member not found in record" });
    }

    const currentMember = family.familyMembers[memberIndex].toObject();
    const mergedData = {
      ...currentMember,
      ...body,
    };

    const formatted = formatFamilyMember(mergedData);
    validateMemberFields(formatted);

    // Update the subdocument fields
    Object.assign(family.familyMembers[memberIndex], formatted);
    await family.save();
    await family.populate("userId", "firstName lastName name email employeeCode");

    return res.status(200).json({
      message: "Family member updated successfully",
      data: family,
      updatedMember: family.familyMembers[memberIndex],
    });
  } catch (error) {
    console.error("updateFamilyMember Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 8. DELETE A SPECIFIC FAMILY MEMBER
 */
export const deleteFamilyMember = async (req, res) => {
  try {
    const body = req.body || {};
    const memberId = req.params?.memberId || body.memberId || body.id;
    const userId = req.params?.userId || body.userId || body.userid;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "Valid memberId is required" });
    }

    let query = { "familyMembers._id": memberId };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    const family = await Family.findOneAndUpdate(
      query,
      { $pull: { familyMembers: { _id: memberId } } },
      { new: true }
    ).populate("userId", "firstName lastName name email employeeCode");

    if (!family) {
      return res.status(404).json({ message: "Family member not found" });
    }

    return res.status(200).json({
      message: "Family member removed successfully",
      data: family,
    });
  } catch (error) {
    console.error("deleteFamilyMember Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 9. DELETE FULL FAMILY RECORD
 */
export const deleteFamily = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.params?.userId || req.params?.userid || body.userId || body.userid;
    const id = req.params?.id || body.id;

    let query = {};
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query = { userId };
    } else if (id && mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      return res.status(400).json({ message: "Valid userId or document id is required" });
    }

    const deleted = await Family.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ message: "Family record not found" });
    }

    return res.status(200).json({
      message: "Family record deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("deleteFamily Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * 10. VERIFY FAMILY RECORD (HR / Admin)
 */
export const verifyFamily = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.params?.userId || body.userId;
    const { isVerified = true, verifiedBy, remarks } = body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const family = await Family.findOneAndUpdate(
      { userId },
      {
        $set: {
          isVerified,
          verifiedBy: verifiedBy || req.user?._id || null,
          verifiedAt: isVerified ? new Date() : null,
          ...(remarks ? { remarks } : {}),
        },
      },
      { new: true }
    )
      .populate("userId", "firstName lastName name email employeeCode")
      .populate("verifiedBy", "firstName lastName name email employeeCode");

    if (!family) {
      return res.status(404).json({ message: "Family record not found" });
    }

    return res.status(200).json({
      message: "Family verification status updated successfully",
      data: family,
    });
  } catch (error) {
    console.error("verifyFamily Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

// Aliases for compatibility
export const createFamilyMember = addFamilyMember;
export default {
  createFamily,
  addFamilyMember,
  createFamilyMember,
  getFamilyByUserId,
  getAllFamilyMembers,
  getFamilyById,
  updateFamily,
  updateFamilyMember,
  deleteFamilyMember,
  deleteFamily,
  verifyFamily,
};
