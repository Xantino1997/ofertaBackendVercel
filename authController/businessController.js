const Business = require("../models/businessModel");
const User = require("../models/userModel");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

const VALID_CATEGORIES = [
  "tecnologia", "ropa", "alimentos", "hogar",
  "deportes", "belleza", "mascotas", "juguetes",
];

/* ── UPSERT ── */
exports.upsertBusiness = async (req, res) => {
  try {
    let logoUrl, logoPublicId;

    if (req.file) {
      const existing = await Business.findOne({ owner: req.user.id });
      if (existing?.logoPublicId) await cloudinary.uploader.destroy(existing.logoPublicId);
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "businesses/logos",
        transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
      });
      logoUrl = result.secure_url;
      logoPublicId = result.public_id;
      fs.unlinkSync(req.file.path);
    }

    // ─── Parsear categorías ────────────────────────────────────────────────
    let categories = [];
    if (req.body.categories) {
      try {
        categories = JSON.parse(req.body.categories);
      } catch {
        categories = Array.isArray(req.body.categories)
          ? req.body.categories
          : [req.body.categories];
      }
      categories = categories
        .filter((c) => VALID_CATEGORIES.includes(c))
        .slice(0, 2);
    }

    // ─── Validar teléfono ──────────────────────────────────────────────────
    const phone = (req.body.phone || "").trim();
    if (!phone) {
      return res.status(400).json({ message: "El número de celular es obligatorio para que los compradores puedan contactarte." });
    }

    const updateData = {
      name:        req.body.name,
      description: req.body.description,
      city:        req.body.city,
      phone,                            // ← NUEVO
      categories,
      owner:       req.user.id,
      ...(logoUrl && { logo: logoUrl, logoPublicId }),
    };

    const business = await Business.findOneAndUpdate(
      { owner: req.user.id },
      updateData,
      { new: true, upsert: true }
    );

    res.json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* ── GET MY BUSINESS ── */
exports.getMyBusiness = async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user.id });
    if (!business) return res.status(404).json({ message: "No existe negocio" });
    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── GET BY ID (público) ── */
exports.getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });
    res.json(business);
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ message: "ID inválido" });
    res.status(500).json({ message: error.message });
  }
};

/* ── FOLLOW ── */
exports.followBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await Business.findByIdAndUpdate(id, { $addToSet: { followers: userId } });
    await User.findByIdAndUpdate(userId, { $addToSet: { followingBusinesses: id } });
    const business = await Business.findById(id).select("followers");
    res.json({ followersCount: business.followers.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── UNFOLLOW ── */
exports.unfollowBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await Business.findByIdAndUpdate(id, { $pull: { followers: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { followingBusinesses: id } });
    const business = await Business.findById(id).select("followers");
    res.json({ followersCount: business.followers.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── FAVORITE ── */
exports.favoriteBusiness = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { favoriteBusinesses: req.params.id } });
    res.json({ saved: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── UNFAVORITE ── */
exports.unfavoriteBusiness = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { favoriteBusinesses: req.params.id } });
    res.json({ saved: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── RATE (1-5 estrellas) ── */
exports.rateBusiness = async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Rating debe ser entre 1 y 5" });

    const userId = req.user.id;
    const businessId = req.params.id;

    const user = await User.findById(userId);
    const prevRating = user.ratedBusinesses.find(
      (r) => r.businessId.toString() === businessId
    );

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });

    if (prevRating) {
      const newSum = business.ratingSum - prevRating.rating + rating;
      const newAvg = newSum / business.totalRatings;
      await Business.findByIdAndUpdate(businessId, {
        ratingSum: newSum,
        rating: Math.round(newAvg * 10) / 10,
      });
      await User.updateOne(
        { _id: userId, "ratedBusinesses.businessId": businessId },
        { $set: { "ratedBusinesses.$.rating": rating } }
      );
    } else {
      const newTotal = business.totalRatings + 1;
      const newSum = (business.ratingSum || 0) + rating;
      const newAvg = newSum / newTotal;
      await Business.findByIdAndUpdate(businessId, {
        totalRatings: newTotal,
        ratingSum: newSum,
        rating: Math.round(newAvg * 10) / 10,
      });
      await User.findByIdAndUpdate(userId, {
        $push: { ratedBusinesses: { businessId, rating } },
      });
    }

    const updated = await Business.findById(businessId).select("rating totalRatings");
    res.json({ rating: updated.rating, totalRatings: updated.totalRatings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ── SOCIAL STATUS ── */
exports.getBusinessSocialStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const businessId = req.params.id;

    const user = await User.findById(userId).select(
      "followingBusinesses favoriteBusinesses ratedBusinesses"
    );
    const business = await Business.findById(businessId).select(
      "followers rating totalRatings"
    );

    if (!user || !business) return res.status(404).json({ message: "No encontrado" });

    const ratedEntry = user.ratedBusinesses?.find(
      (r) => r.businessId.toString() === businessId
    );

    res.json({
      following:      user.followingBusinesses.map((id) => id.toString()).includes(businessId),
      saved:          user.favoriteBusinesses.map((id) => id.toString()).includes(businessId),
      myRating:       ratedEntry?.rating || 0,
      followersCount: business.followers.length,
      rating:         business.rating,
      totalRatings:   business.totalRatings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};