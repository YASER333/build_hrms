// Modules/RoleMenuModule.js
import mongoose from "mongoose";
const roleMenuSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true
    },
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true
    },
  },
  { timestamps: true }                                                                                          
);

// Prevent duplicate role-menu mapping
roleMenuSchema.index({ roleId: 1, menuId: 1 }, { unique: true });

const RoleMenu = mongoose.model("RoleMenu", roleMenuSchema);
export default RoleMenu;
