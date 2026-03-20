const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    team: {
      type: String,
      default: "N/A",
      trim: true
    },
    category: {
      type: String,
      enum: ["NBA", "Hockey", "Soccer"],
      required: true
    },
    type: {
      type: String,
      default: "N/A",
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    sizes: {
      S: {
        type: Number,
        default: 0,
        min: 0
      },
      M: {
        type: Number,
        default: 0,
        min: 0
      },
      L: {
        type: Number,
        default: 0,
        min: 0
      },
      XL: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    image: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);