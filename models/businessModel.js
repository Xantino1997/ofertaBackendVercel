const mongoose = require("mongoose");

const VALID_CATEGORIES = [
  "tecnologia", "ropa", "alimentos", "hogar",
  "deportes", "belleza", "mascotas", "juguetes",
];

const businessSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    description:  String,
    city:         String,
    phone:        { type: String, default: "" },   // ← NUEVO: teléfono de contacto
    logo:         String,
    logoPublicId: String,
    rating:       { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    ratingSum:    { type: Number, default: 0 },
    totalProducts:{ type: Number, default: 0 },
    verified:     { type: Boolean, default: false },
    blocked:      { type: Boolean, default: false },
    blockedReason:{ type: String },
    followers:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    categories: {
      type: [{ type: String, enum: VALID_CATEGORIES }],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 2,
        message: "Un negocio puede tener máximo 2 categorías",
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);