import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true]
    },

    addressType: {
      type: String,
      enum: ["Permanent", "Current / Present", "Official", "Current", "Present"],
      default: "Permanent",
      trim: true
    },

    address1: {
      type: String,
      required: [true],
      trim: true,
      minlength: [3]
    },

    address2: {
      type: String,
      trim: true
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true
    },

    state: {
      type: String,
      required: [true],
      trim: true
    },

    country: {
      type: String,
      required: [true],
      default: "India"
    },

    pincode: {
      type: String,
      required: [true],
      match: [/^[0-9]{6}$/]
    }
  },
  {
    timestamps: true
  }
);

const Address = mongoose.model("Address", addressSchema);
export default Address;
