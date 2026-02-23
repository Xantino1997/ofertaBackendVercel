// routes/pushRoute.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const webpush = require("web-push");
const PushSub = require("../models/pushsuscriptionmodel");
const User = require("../models/userModel");

// ── Configurar VAPID (generá las keys con: npx web-push generate-vapid-keys) ──
webpush.setVapidDetails(
  `mailto:"ala282016@gmail.com"}`,
  "BLR8fiu0VNED_-qHI0rOQn_UPEtJptD4wiYJXuBQxgBhFFRf_SvU54F95IBaBG86V-cv3wwZ4l_NlLD236io1rw",
  "aGmJeLDh7nI-_FnpDVVhrx2Yk8xDa80unM1b1t__MB8",
);

// ─── POST /api/push/subscribe ─────────────────────────────────────────────
// El browser llama esto cuando el user acepta notificaciones
router.post("/subscribe", auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({ message: "Suscripción inválida" });
    }

    // Upsert: si ya existe el endpoint lo actualiza, si no lo crea
    await PushSub.findOneAndUpdate(
      { "subscription.endpoint": subscription.endpoint },
      { user: req.user.id, subscription },
      { upsert: true, new: true },
    );

    res.json({ message: "Suscripción guardada" });
  } catch (err) {
    console.error("Error /push/subscribe:", err);
    res.status(500).json({ message: "Error guardando suscripción" });
  }
});

// ─── DELETE /api/push/unsubscribe ─────────────────────────────────────────
router.delete("/unsubscribe", auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSub.deleteOne({
      "subscription.endpoint": endpoint,
      user: req.user.id,
    });
    res.json({ message: "Suscripción eliminada" });
  } catch (err) {
    res.status(500).json({ message: "Error eliminando suscripción" });
  }
});

// ─── PUT /api/push/location ───────────────────────────────────────────────
// Guarda la ubicación del usuario en su documento de User
router.put("/location", auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: "lat y lng son requeridos" });
    }

    await User.findByIdAndUpdate(req.user.id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      locationEnabled: true,
    });

    res.json({ message: "Ubicación guardada", lat, lng });
  } catch (err) {
    console.error("Error /push/location:", err);
    res.status(500).json({ message: "Error guardando ubicación" });
  }
});

// ─── Función exportada para enviar push a seguidores de un negocio ────────
// La llama productController cuando se crea un producto nuevo
async function notifyBusinessFollowers({
  businessId,
  businessName,
  productName,
  productId,
}) {
  try {
    // Buscar todos los usuarios que siguen este negocio
    const followers = await User.find({
      followingBusinesses: businessId,
    })
      .select("_id")
      .lean();

    if (!followers.length) return;

    const followerIds = followers.map((f) => f._id);

    // Buscar todas las suscripciones push de esos usuarios
    const subs = await PushSub.find({ user: { $in: followerIds } }).lean();

    if (!subs.length) return;

    const payload = JSON.stringify({
      title: `🆕 ${businessName} publicó algo nuevo`,
      body: `"${productName}" ya está disponible. ¡Miralo ahora!`,
      url: `/negocio/${businessId}`,
      icon: "/icon.png",
      badge: "/badge.png",
    });

    // Enviar a todos en paralelo, ignorar los que fallen (token expirado, etc.)
    const sends = subs.map(async (doc) => {
      try {
        await webpush.sendNotification(doc.subscription, payload);
      } catch (err) {
        // Si el endpoint ya no existe (410 Gone), borrarlo
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSub.deleteOne({ _id: doc._id });
        }
      }
    });

    await Promise.allSettled(sends);
    console.log(
      `[Push] Notificaciones enviadas a ${subs.length} dispositivos — negocio: ${businessName}`,
    );
  } catch (err) {
    console.error("[Push] Error notifyBusinessFollowers:", err);
  }
}

module.exports = { router, notifyBusinessFollowers };
