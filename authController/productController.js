// authController/productController.js
const Product  = require("../models/productoModel");
const Business = require("../models/businessModel");
const Featured = require("../models/featuredModel");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

// ── Importar función de push (lazy para evitar circular deps) ──────────────
function getPushNotifier() {
  return require("../routes/pushRoute").notifyBusinessFollowers;
}

// Helper para obtener ID de negocio
async function getBusinessId(userId) {
  const business = await Business.findOne({ owner: userId });
  return business ? business._id : null;
}

// Helper para distancia
function calcularDistanciaKM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BIZ_SELECT = "name city logo blocked verified rating totalRatings followers phone";

function mapBusiness(p) {
  const { businessId, ...rest } = p;
  return { ...rest, business: businessId ?? null };
}

// ─────────────────────────────────────────────
// RUTAS PRIVADAS
// ─────────────────────────────────────────────

exports.getMyProducts = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) return res.json([]);
    const products = await Product.find({ businessId });
    res.json(products);
  } catch (error) {
    console.error("Error getMyProducts:", error);
    res.status(500).json({ message: "Error al obtener tus productos" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user.id });
    if (!business)
      return res.status(400).json({ message: "Crea tu negocio primero" });

    const businessId = business._id;

    let imageUrl = null, publicId = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "products",
      });
      imageUrl = result.secure_url;
      publicId = result.public_id;
      fs.unlinkSync(req.file.path);
    }

    const { lat, lng, price, discount, stock, deliveryRadius, ...rest } = req.body;

    let coordinates;
    if (lat && lng) {
      coordinates = [parseFloat(lng), parseFloat(lat)];
    } else if (business?.location?.coordinates?.length) {
      coordinates = business.location.coordinates;
    }

    const newProduct = await Product.create({
      ...rest,
      price:          parseFloat(price),
      discount:       parseFloat(discount || 0),
      stock:          parseInt(stock || 10),
      deliveryRadius: parseFloat(deliveryRadius || 0),
      user:           req.user.id,
      businessId,
      image:          imageUrl,
      imagePublicId:  publicId,
      location:       coordinates ? { type: "Point", coordinates } : undefined,
    });

    // ── Notificar a seguidores via Push (no bloquea la respuesta) ──────────
    getPushNotifier()({
      businessId:   businessId.toString(),
      businessName: business.name,
      productName:  newProduct.name,
      productId:    newProduct._id.toString(),
    }).catch(err => console.error("[Push] Error al notificar seguidores:", err));

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error createProduct:", error);
    res.status(500).json({ message: "Error creando producto", detail: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (req.file) {
      if (product.imagePublicId)
        await cloudinary.uploader.destroy(product.imagePublicId);
      const result = await cloudinary.uploader.upload(req.file.path, { folder: "products" });
      product.image = result.secure_url;
      product.imagePublicId = result.public_id;
      fs.unlinkSync(req.file.path);
    }

    const { lat, lng, price, discount, stock, deliveryRadius, ...rest } = req.body;

    if (price !== undefined)          product.price          = parseFloat(price);
    if (discount !== undefined)       product.discount       = parseFloat(discount);
    if (stock !== undefined)          product.stock          = parseInt(stock);
    if (deliveryRadius !== undefined) product.deliveryRadius = parseFloat(deliveryRadius);

    Object.assign(product, rest);

    if (lat && lng) {
      product.location = { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] };
    }

    await product.save();
    res.json(product);
  } catch (error) {
    console.error("Error updateProduct:", error);
    res.status(500).json({ message: "Error actualizando producto", detail: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Producto no encontrado" });

    if (product.imagePublicId)
      await cloudinary.uploader.destroy(product.imagePublicId);

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error deleteProduct:", error);
    res.status(500).json({ message: "Error eliminando producto" });
  }
};

// ─────────────────────────────────────────────
// RUTAS PÚBLICAS
// ─────────────────────────────────────────────

exports.getPublicProducts = async (req, res) => {
  try {
    const { lat, lng, category, search, businessId, limit } = req.query;

    const query = {};
    if (category)   query.category   = category;
    if (search)     query.name       = { $regex: search, $options: "i" };
    if (businessId) query.businessId = businessId; // ✅ FIX: filtrar por negocio

    const maxResults = parseInt(limit) || 100;

    const raw      = await Product.find(query).limit(maxResults).populate("businessId", BIZ_SELECT).lean();
    const products = raw.map(mapBusiness);

    const filtered = products.filter((p) => {
      if (p.business?.blocked) return false;
      if (!p.deliveryRadius || p.deliveryRadius === 0) return true;
      if (!lat || !lng) return true;
      if (!p.location?.coordinates?.length) return true;
      const dist = calcularDistanciaKM(
        parseFloat(lat), parseFloat(lng),
        p.location.coordinates[1], p.location.coordinates[0]
      );
      return dist <= p.deliveryRadius;
    });

    res.json({ products: filtered });
  } catch (err) {
    console.error("Error getPublicProducts:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getRandomProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const raw = await Product.aggregate([{ $sample: { size: limit } }]);
    const populated = await Product.populate(raw, { path: "businessId", select: BIZ_SELECT });
    const products  = populated.map(mapBusiness);
    res.json({ products });
  } catch (err) {
    console.error("Error getRandomProducts:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getFeaturedBusinesses = async (req, res) => {
  try {
    const featured = await Featured.find({ active: true })
      .populate({
        path: "business",
        select: "name city logo verified rating totalRatings followers description totalProducts",
      })
      .lean();
    const active = featured.filter(f => f.business && !f.business.blocked);
    res.json(active);
  } catch (err) {
    console.error("Error getFeaturedBusinesses:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicStats = async (req, res) => {
  try {
    const [totalProducts, totalBusinesses] = await Promise.all([
      Product.countDocuments(),
      Business.countDocuments({ blocked: { $ne: true } }),
    ]);
    res.json({ totalProducts, totalBusinesses });
  } catch (err) {
    console.error("Error getPublicStats:", err);
    res.status(500).json({ message: err.message });
  }
};
