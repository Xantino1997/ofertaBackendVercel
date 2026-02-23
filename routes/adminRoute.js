// routes/adminRoute.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const { requireAdmin, getDashboardStats, getAllUsers, toggleBlockUser, changeUserRole,
        getAllBusinesses, toggleVerifyBusiness, toggleBlockBusiness,
        setFeatured, removeFeatured, getAllFeatured } = require("../authController/adminController");

// Todas las rutas requieren auth + admin
router.use(auth, requireAdmin);

// Dashboard
router.get("/stats",           getDashboardStats);

// Usuarios
router.get("/users",           getAllUsers);
router.patch("/users/:id/block",    toggleBlockUser);
router.patch("/users/:id/role",     changeUserRole);

// Negocios
router.get("/businesses",               getAllBusinesses);
router.patch("/businesses/:id/verify",  toggleVerifyBusiness);
router.patch("/businesses/:id/block",   toggleBlockBusiness);

// Destacados
router.get("/featured",                         getAllFeatured);
router.post("/featured",                        setFeatured);
router.delete("/featured/:businessId",          removeFeatured);

module.exports = router;