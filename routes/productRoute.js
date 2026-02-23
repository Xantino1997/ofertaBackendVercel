const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const auth = require("../middleware/authMiddleware");

const productCtrl = require("../authController/productController");

// ── Validación de Seguridad ──
// Si alguna función no existe en el controlador, el servidor se detendrá con un mensaje claro.
const requiredFunctions = [
  'getPublicStats', 'getRandomProducts', 'getFeaturedBusinesses', 
  'getPublicProducts', 'getMyProducts', 'createProduct', 
  'updateProduct', 'deleteProduct'
];

requiredFunctions.forEach(fn => {
  if (typeof productCtrl[fn] !== 'function') {
    throw new Error(`ERROR: La función '${fn}' no está definida en productController.js`);
  }
});

// ── Rutas Públicas ──
router.get("/public-stats", productCtrl.getPublicStats);
router.get("/random", productCtrl.getRandomProducts);
router.get("/featured-businesses", productCtrl.getFeaturedBusinesses);
router.get("/", productCtrl.getPublicProducts);

// ── Rutas Privadas ──
router.get("/my-products", auth, productCtrl.getMyProducts);
router.post("/", auth, upload.single("image"), productCtrl.createProduct);
router.put("/:id", auth, upload.single("image"), productCtrl.updateProduct);
router.delete("/:id", auth, productCtrl.deleteProduct);

module.exports = router;