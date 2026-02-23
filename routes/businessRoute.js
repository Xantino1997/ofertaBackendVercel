// routes/businessRoute.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  upsertBusiness,
  getMyBusiness,
  getBusinessById,
  followBusiness,
  unfollowBusiness,
  favoriteBusiness,
  unfavoriteBusiness,
  rateBusiness,
  getBusinessSocialStatus,
} = require("../authController/businessController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/", verifyToken, upload.single("logo"), upsertBusiness);
router.get("/my-business", verifyToken, getMyBusiness);

// Social (requieren auth)
router.post("/:id/follow",     verifyToken, followBusiness);
router.post("/:id/unfollow",   verifyToken, unfollowBusiness);
router.post("/:id/favorite",   verifyToken, favoriteBusiness);
router.post("/:id/unfavorite", verifyToken, unfavoriteBusiness);
router.post("/:id/rate",       verifyToken, rateBusiness);
router.get("/:id/social",      verifyToken, getBusinessSocialStatus); // estado del user para este negocio

router.get("/:id", getBusinessById); // público — al final para no chocar

module.exports = router;