import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        // ==========================================
        // ROLE NAME
        // ==========================================
        roleName: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 50,
        },

        // ==========================================
        // ROLE CODE
        // ==========================================
        roleCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
        },

        // ==========================================
        // ROLE PRIORITY
        // 1 = Owner (Super Authority)
        // 2 = System Admin
        // 3+ = Custom Roles / Employees
        // ==========================================
        priority: {
            type: Number,
            default: 3,
            min: [1, "Priority must be a positive integer"],
            validate: {
                validator: Number.isInteger,
                message: "Priority must be an integer",
            },
        },

        // ==========================================
        // STATUS
        // ==========================================
        isActive: {
            type: Boolean,
            default: true,
        },

        isBlock: {
            type: Boolean,
            default: false,
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },

        isSystemRole: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Normalize Role Name
roleSchema.pre("save", function (next) {
    if (this.roleName) {
        const trimmed = this.roleName.trim().replace(/\s+/g, " ");
        if (trimmed.toUpperCase() === "HR") {
            this.roleName = "HR";
        } else {
            this.roleName = trimmed
                .split(" ")
                .map(
                    (word) =>
                        word.toUpperCase() === "HR"
                            ? "HR"
                            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join(" ");
        }
    }
    next();
});

// Generate Role Code if not provided
roleSchema.pre("validate", function (next) {
    if (!this.roleCode && this.roleName) {
        this.roleCode = this.roleName
            .trim()
            .replace(/\s+/g, "_")
            .toUpperCase();
    }
    next();
});

const Role = mongoose.model("Role", roleSchema);
export default Role;