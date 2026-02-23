// models/userModel.js
// CAMBIO: se agregan lat, lng y pushEnabled para ubicación y notificaciones push
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ["user", "seller", "admin"], default: "user" },
    avatar: { type: String, default: "/assets/offerton.jpg" },
    avatarPublicId: String,
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    verificationCode: String,
    verified: { type: Boolean, default: false },
    resetPasswordCode: { type: String, default: null },
    resetPasswordCodeExpires: { type: Date, default: null },
    purchases: { type: Number, default: 0 },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    followingBusinesses: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    ],
    favoriteBusinesses: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    ],
    ratedBusinesses: [
      {
        businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
        rating: Number,
      },
    ],
    pushSubscription: {
      type: Object,
      default: null,
    },

    // ── Reputación como comprador ─────────────────────────────────────────
    buyerRating: { type: Number, default: 0 },
    buyerRatingSum: { type: Number, default: 0 },
    buyerTotalRatings: { type: Number, default: 0 },

    // ── Ubicación del usuario (guardada desde el frontend) ────────────────
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    locationEnabled: { type: Boolean, default: false },

    // ── Preferencias de notificaciones ────────────────────────────────────
    notificationsEnabled: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false }, // true cuando tiene suscripción push activa
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
