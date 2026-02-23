// routes/chatRoute.js
// Sigue el mismo patrón que tus otras rutas (router.get/post/delete + middleware)

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const auth = require('../middleware/authMiddleware');   // tu middleware JWT existente
const {
  startConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  deleteMessage,
} = require('../authController/chatController');

// ── Multer: guardar imágenes en /uploads/chat ─────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:    (_, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 },    // 5 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Iniciar o retomar conversación con un negocio/usuario
router.post('/start',                           auth, startConversation);

// Listar todas las conversaciones del usuario autenticado
router.get('/conversations',                    auth, getConversations);

// Mensajes de una conversación específica (?skip=0&limit=50)
router.get('/conversations/:id/messages',       auth, getMessages);

// Marcar conversación como leída
router.post('/conversations/:id/read',          auth, markAsRead);

// Borrar conversación (soft-delete, solo para el usuario actual)
router.delete('/conversations/:id',             auth, deleteConversation);

// Enviar mensaje (texto y/o imagen)
router.post('/messages', auth, upload.single('image'), sendMessage);

// Borrar mensaje propio (soft-delete)
router.delete('/messages/:id',                  auth, deleteMessage);

module.exports = router;