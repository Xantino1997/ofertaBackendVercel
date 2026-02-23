// authController/adminController.js
const User     = require("../models/userModel");
const Business = require("../models/businessModel");
const Featured = require("../models/featuredModel");
const Product  = require("../models/productoModel");

/* ── MIDDLEWARE: solo admin ───────────────────────── */
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Acceso denegado" });
  next();
};

/* ── DASHBOARD STATS ─────────────────────────────── */
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalBusinesses, totalProducts, activeFeatured, blockedUsers, blockedBusinesses] =
      await Promise.all([
        User.countDocuments(),
        Business.countDocuments(),
        Product.countDocuments(),
        Featured.countDocuments({ active: true, endDate: { $gte: new Date() } }),
        User.countDocuments({ blocked: true }),
        Business.countDocuments({ blocked: true }),
      ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt");

    res.json({ totalUsers, totalBusinesses, totalProducts, activeFeatured, blockedUsers, blockedBusinesses, recentUsers });
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo stats" });
  }
};

/* ── USUARIOS ────────────────────────────────────── */
exports.getAllUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const query = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).select("-password -verificationCode"),
      User.countDocuments(query),
    ]);

    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo usuarios" });
  }
};

exports.toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    if (user.role === "admin") return res.status(400).json({ message: "No se puede bloquear a un admin" });

    user.blocked = !user.blocked;
    await user.save();
    res.json({ message: user.blocked ? "Usuario bloqueado" : "Usuario desbloqueado", blocked: user.blocked });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "seller", "admin"].includes(role))
      return res.status(400).json({ message: "Rol inválido" });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    res.json({ message: "Rol actualizado", user });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ── NEGOCIOS ────────────────────────────────────── */
exports.getAllBusinesses = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const [businesses, total] = await Promise.all([
      Business.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("owner", "name email"),
      Business.countDocuments(query),
    ]);

    // Agregar info de featured activo a cada negocio
    const now = new Date();
    const businessesWithFeatured = await Promise.all(
      businesses.map(async (b) => {
        const featured = await Featured.findOne({
          business: b._id,
          active: true,
          endDate: { $gte: now },
        });
        return { ...b.toObject(), featuredInfo: featured || null };
      })
    );

    res.json({ businesses: businessesWithFeatured, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo negocios" });
  }
};

exports.toggleVerifyBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate("owner", "name email");
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });

    business.verified = !business.verified;
    await business.save();

    res.json({
      message: business.verified ? "Negocio verificado" : "Verificación removida",
      verified: business.verified,
    });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

exports.toggleBlockBusiness = async (req, res) => {
  try {
    const { reason } = req.body;
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });

    business.blocked = !business.blocked;
    business.blockedReason = business.blocked ? (reason || "Bloqueado por administrador") : null;
    await business.save();

    res.json({ message: business.blocked ? "Negocio bloqueado" : "Negocio desbloqueado", blocked: business.blocked });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ── DESTACADOS ──────────────────────────────────── */
exports.setFeatured = async (req, res) => {
  try {
    const { businessId, type, days, note } = req.body;

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });

    // Calcular duración
    const durationMap = { daily: 1, weekly: 7, monthly: 30 };
    const durationDays = type === "custom" ? Number(days) : (durationMap[type] || 7);

    const startDate = new Date();
    const endDate   = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Desactivar cualquier featured anterior activo
    await Featured.updateMany({ business: businessId, active: true }, { active: false });

    const featured = await Featured.create({
      business: businessId,
      type,
      startDate,
      endDate,
      active: true,
      note,
      addedBy: req.user.id,
    });

    res.status(201).json({ message: `Negocio destacado por ${durationDays} días`, featured });
  } catch (error) {
    res.status(500).json({ message: "Error creando destacado" });
  }
};

exports.removeFeatured = async (req, res) => {
  try {
    await Featured.updateMany({ business: req.params.businessId, active: true }, { active: false });
    res.json({ message: "Destacado removido" });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

exports.getAllFeatured = async (req, res) => {
  try {
    const now = new Date();
    const featured = await Featured.find({ active: true, endDate: { $gte: now } })
      .populate({ path: "business", select: "name city logo verified owner", populate: { path: "owner", select: "name email" } })
      .populate("addedBy", "name")
      .sort({ endDate: 1 });

    res.json(featured);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};