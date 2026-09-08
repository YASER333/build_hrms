import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "bm8jpw22",
  api_key: process.env.CLOUDINARY_API_KEY || "814662163219963",
  api_secret: process.env.CLOUDINARY_API_SECRET || "_X0rbTKsBNAMiB7EStoAz_PC9bg",
  secure: true,
});

/**
 * Upload a buffer to Cloudinary using a stream.
 * @param {Buffer} fileBuffer - File buffer from Multer
 * @param {Object} options - Upload options (folder, public_id, resource_type)
 * @returns {Promise<Object>} Cloudinary upload response object
 */
export const uploadBufferToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "hrms_documents",
        resource_type: options.resourceType || "auto",
        public_id: options.publicId,
        overwrite: options.overwrite || true,
        use_filename: true,
        unique_filename: true,
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete a file from Cloudinary by publicId.
 */
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Cloudinary delete error:", error.message);
    throw error;
  }
};

export default cloudinary;
