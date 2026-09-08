import mongoose from "mongoose";

/**
 * Permission Schema
 * Represents granular actions that can be granted to roles.
 * Examples: 'attendance.punch_in', 'attendance.read.own', 'project.create'
 */
const permissionSchema = new mongoose.Schema(
  {
    permissionName: {
      type: String,
      required: true,
      trim: true,
    },
    permissionCode: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize lookups by module
permissionSchema.index({ module: 1 });

const Permission = mongoose.model("Permission", permissionSchema);
export default Permission;
