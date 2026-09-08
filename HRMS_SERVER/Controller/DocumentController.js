import Document from "../Modules/DocumentModule.js";

// Helper to convert empty strings to undefined (for sparse unique indexes)
const cleanBuffer = (data) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === "") cleaned[key] = undefined;
  });
  return cleaned;
};

const handleDuplicateError = (err) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }
  return err.message;
};


export const createDocument = async (req, res) => {
  try {
    const { userId, accountNo, ifsc, aadhaarNo, panNo } = req.body;

    if (!userId || !accountNo || !ifsc || !aadhaarNo || !panNo) {
      return res.status(400).json({ message: "Mandatory fields are missing" });
    }

    const existing = await Document.findOne({ userId });
    if (existing) {
      return res.status(400).json({ message: "Document record already exists for this user" });
    }

    const cleanedData = cleanBuffer(req.body);
    const document = await Document.create(cleanedData);

    return res.status(201).json({ message: "Document created successfully", document });
  } catch (err) {
    const message = handleDuplicateError(err);
    return res.status(err.code === 11000 ? 409 : 400).json({ message });
  }
};

export const getDocumentByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const document = await Document.findOne({ userId });
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(200).json(document);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().populate(
      "userId",
      "firstName lastName email"
    );

    return res.status(200).json(documents);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateDocumentByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = cleanBuffer(req.body);

    if (!userId || Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No data provided for update" });
    }

    const document = await Document.findOneAndUpdate(
      { userId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(200).json({ message: "Document updated successfully", document });
  } catch (err) {
    const message = handleDuplicateError(err);
    return res.status(err.code === 11000 ? 409 : 400).json({ message });
  }
};

export const deleteDocumentByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const document = await Document.findOneAndDelete({ userId });
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(200).json({ message: "Document deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
