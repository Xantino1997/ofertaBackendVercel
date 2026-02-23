const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true },
    description:   String,
    price:         { type: Number, required: true },
    discount:      { type: Number, default: 0, min: 0, max: 100 },
    category:      String,
    stock:         { type: Number, default: 10 },
    image:         String,
    imagePublicId: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    },
    // ✅ Sin default en type, sin default en coordinates
    // Si no vienen coords, Mongoose no crea el subdocumento y MongoDB no valida el índice
    location: {
      type:        { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    deliveryRadius: { type: Number, default: 0 },
  },
  { timestamps: true }
);


productSchema.index({ location: "2dsphere" }, { sparse: true });

productSchema.set("toJSON",   { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = Product;