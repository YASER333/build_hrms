import multer from "multer";
import path from "path";
import { uploadBufferToCloudinary } from "../Utils/CloudinaryConfig.js";

// Allowed MIME types map
export const ALLOWED_MIME_TYPES = {
  // Images
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  // Documents
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
};

// Executable and dangerous extensions to block strictly
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".php", ".js", ".vbs", ".jar", ".scr", ".pif"];

// Memory storage engine for Multer
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Security Error: Uploading executable files (${ext}) is strictly prohibited.`), false);
  }

  cb(null, true);
};

// Multer upload middleware instance (10MB default limit)
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

/**
 * Validates file against specific requirement rules.
 */
export const validateFileRequirements = ({ file, allowedMimeTypes, maxFileSize }) => {
  if (!file) {
    throw new Error("No file uploaded.");
  }

  // 1. File size check
  const sizeLimit = maxFileSize || 10 * 1024 * 1024;
  if (file.size > sizeLimit) {
    const sizeInMb = (sizeLimit / (1024 * 1024)).toFixed(1);
    throw new Error(`File size exceeds maximum allowed limit of ${sizeInMb} MB.`);
  }

  // 2. MIME type check
  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
    if (!isMimeAllowed) {
      throw new Error(`Invalid file type '${file.mimetype}'. Allowed types: ${allowedMimeTypes.join(", ")}`);
    }
  }
};

/**
 * Upload single file buffer to Cloudinary
 */
export const processCloudinaryUpload = async ({ file, folder = "hrms_documents", entityId = "general" }) => {
  const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = path.extname(sanitizedOriginalName);
  const baseName = path.basename(sanitizedOriginalName, ext);
  const publicId = `${folder}/${entityId}_${baseName}_${Date.now()}`;

  const isImage = file.mimetype.startsWith("image/");
  const resourceType = isImage ? "image" : "raw";

  const cloudinaryResult = await uploadBufferToCloudinary(file.buffer, {
    folder,
    publicId,
    resourceType,
  });

  return {
    fileUrl: cloudinaryResult.secure_url,
    publicId: cloudinaryResult.public_id,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
};
