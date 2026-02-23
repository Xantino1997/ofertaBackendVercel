// models/featuredModel.js
const mongoose = require("mongoose");

const featuredSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    type: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
      default: "weekly",
    },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    active:    { type: Boolean, default: true },
    note:      { type: String },  // ej: "Plan pagado Premium"
    addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Virtual: ¿sigue activo hoy?
featuredSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  return this.active && this.startDate <= now && this.endDate >= now;
});

featuredSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Featured", featuredSchema);