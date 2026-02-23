// controllers/chatController.js
// Sigue el mismo patrón que tus otros controllers (exports.method = async(req,res) => {})

const path   = require('path');
const fs     = require('fs');
const { Conversation, Message } = require('../models/chatModel');

// ─── Helpers privados ─────────────────────────────────────────────────────────

// Cuántos mensajes no leídos tiene `userId` en una conversación
async function _unreadCount(convId, userId) {
  return Message.countDocuments({
    conversation: convId,
    readBy:       { $nin: [userId] },
    sender:       { $ne:  userId  },
    deletedBy:    { $nin: [userId] },
  });
}

// Serializa una conv para enviar al cliente
async function _formatConv(conv, userId) {
  const other = conv.participants.find(
    p => p._id.toString() !== userId.toString()
  );
  const last = conv.lastMessage;
  const uc   = await _unreadCount(conv._id, userId);

  return {
    _id:          conv._id,
    participants: conv.participants,
    other,
    lastMessage: last
      ? { text: last.text, image: last.image, createdAt: last.createdAt }
      : null,
    updatedAt:   conv.updatedAt,
    unreadCount: uc,
  };
}

// ─── POST /api/chat/start ─────────────────────────────────────────────────────
// Body: { participantId: string }
// Crea o devuelve la conversación entre el usuario autenticado y participantId
exports.startConversation = async (req, res) => {
  try {
    const mongoose = require('mongoose');

    // ── Compatibilidad con distintos middleware JWT ──────────────────────────
    // Algunos middleware ponen req.user.id, otros req.user._id
    const me = req.user?._id || req.user?.id;
    if (!me) {
      console.error('[chat] startConversation: req.user no tiene _id ni id →', req.user);
      return res.status(401).json({ error: 'Usuario no autenticado correctamente' });
    }

    // ── Extraer participantId de forma segura ────────────────────────────────
    // Puede venir como string ID directo o como objeto { _id: '...' }
    let other = req.body.participantId;
    if (other && typeof other === 'object') other = other._id;
    if (other) other = other.toString().trim();

    if (!other) {
      return res.status(400).json({ error: 'participantId requerido' });
    }

    // Validar que sea un ObjectId válido antes de hacer la query
    if (!mongoose.Types.ObjectId.isValid(other)) {
      console.error('[chat] startConversation: participantId inválido →', other);
      return res.status(400).json({ error: 'participantId inválido' });
    }

    if (me.toString() === other) {
      return res.status(400).json({ error: 'No podés chatear contigo mismo' });
    }

    // ── Buscar conv existente entre los dos usuarios ─────────────────────────
    let conv = await Conversation.findOne({
      participants: { $all: [me, other], $size: 2 },
      deletedBy:    { $nin: [me] },
    })
      .populate('participants', 'name avatar logo')
      .populate({ path: 'lastMessage', select: 'text image createdAt' });

    if (!conv) {
      const created = await Conversation.create({ participants: [me, other] });
      conv = await Conversation.findById(created._id)
        .populate('participants', 'name avatar logo')
        .populate({ path: 'lastMessage', select: 'text image createdAt' });
    } else {
      // Si existía pero el user la había borrado, restaurarla
      await Conversation.updateOne({ _id: conv._id }, { $pull: { deletedBy: me } });
    }

    res.json(await _formatConv(conv, me));
  } catch (err) {
    console.error('[chat] startConversation ERROR COMPLETO:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Error al iniciar conversación' });
  }
};

// ─── GET /api/chat/conversations ──────────────────────────────────────────────
// Todas las convs del usuario autenticado, ordenadas por última actividad
exports.getConversations = async (req, res) => {
  try {
    const me = req.user?._id || req.user?.id;

    const convs = await Conversation.find({
      participants: me,
      deletedBy:    { $nin: [me] },
    })
      .populate('participants', 'name avatar logo')
      .populate({ path: 'lastMessage', select: 'text image createdAt' })
      .sort({ updatedAt: -1 });

    const result = await Promise.all(convs.map(c => _formatConv(c, me)));
    res.json(result);
  } catch (err) {
    console.error('[chat] getConversations:', err);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
};

// ─── GET /api/chat/conversations/:id/messages ────────────────────────────────
// Mensajes de una conv (más recientes al final, paginados con ?skip=&limit=)
exports.getMessages = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const me     = req.user?._id || req.user?.id;
    const convId = req.params.id;
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip   = parseInt(req.query.skip) || 0;

    if (!me) return res.status(401).json({ error: 'No autenticado' });

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(convId)) {
      return res.status(400).json({ error: 'ID de conversación inválido' });
    }

    // Verificar que el usuario pertenece a la conv
    const conv = await Conversation.findOne({ _id: convId, participants: me });
    if (!conv) {
      console.error('[chat] getMessages: conv no encontrada →', convId, 'user →', me);
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const msgs = await Message.find({
      conversation: convId,
      deletedBy:    { $nin: [me] },
    })
      .populate('sender', 'name avatar logo')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    res.json(msgs);
  } catch (err) {
    console.error('[chat] getMessages ERROR:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Error al obtener mensajes' });
  }
};

// ─── POST /api/chat/messages ──────────────────────────────────────────────────
// Body (FormData): conversationId, text?, image? (archivo)
exports.sendMessage = async (req, res) => {
  try {
    const me     = req.user?._id || req.user?.id;
    const { conversationId, text } = req.body;

    if (!conversationId) return res.status(400).json({ error: 'conversationId requerido' });
    if (!text?.trim() && !req.file) return res.status(400).json({ error: 'Enviá texto o imagen' });

    // Verificar pertenencia
    const conv = await Conversation.findOne({ _id: conversationId, participants: me });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    // URL de imagen — local; en prod reemplazar con Cloudinary
    let imageUrl = null;
    if (req.file) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      imageUrl = `${baseUrl}/uploads/chat/${req.file.filename}`;
    }

    // Crear mensaje
    const msg = await Message.create({
      conversation: conversationId,
      sender:       me,
      text:         text?.trim() || '',
      image:        imageUrl,
      readBy:       [me],  // el emisor ya lo "leyó"
    });

    // Actualizar conv: lastMessage + updatedAt + restaurar si fue borrada
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: msg._id,
      updatedAt:   msg.createdAt,
      $pull: { deletedBy: { $in: conv.participants } },
    });

    // Populate completo para el socket
    const populated = await Message.findById(msg._id)
      .populate('sender', 'name avatar logo');

    // ── Emitir a ambos participantes vía Socket.io ──────────────────────────
    const io = req.app.get('io');
    if (io) {
      conv.participants.forEach(pid => {
        io.to(`user_${pid.toString()}`).emit('new_message', populated);
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('[chat] sendMessage:', err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
};

// ─── POST /api/chat/conversations/:id/read ───────────────────────────────────
// Marca todos los mensajes de la conv como leídos para el usuario actual
exports.markAsRead = async (req, res) => {
  try {
    const me     = req.user?._id || req.user?.id;
    const convId = req.params.id;

    // Verificar pertenencia
    const conv = await Conversation.findOne({ _id: convId, participants: me });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    await Message.updateMany(
      { conversation: convId, readBy: { $nin: [me] } },
      { $addToSet: { readBy: me } }
    );

    // Notificar al otro participante que sus mensajes fueron leídos (doble check)
    const io = req.app.get('io');
    if (io) {
      conv.participants.forEach(pid => {
        io.to(`user_${pid.toString()}`).emit('messages_read', { conversationId: convId });
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[chat] markAsRead:', err);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
};

// ─── DELETE /api/chat/conversations/:id ──────────────────────────────────────
// Soft-delete: oculta la conv del usuario actual sin borrarla para el otro
exports.deleteConversation = async (req, res) => {
  try {
    const me     = req.user?._id || req.user?.id;
    const convId = req.params.id;

    const conv = await Conversation.findOne({ _id: convId, participants: me });
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

    await Conversation.updateOne({ _id: convId }, { $addToSet: { deletedBy: me } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[chat] deleteConversation:', err);
    res.status(500).json({ error: 'Error al borrar conversación' });
  }
};

// ─── DELETE /api/chat/messages/:id ───────────────────────────────────────────
// Soft-delete de un mensaje propio
exports.deleteMessage = async (req, res) => {
  try {
    const me  = req.user?._id || req.user?.id;
    const msg = await Message.findOne({ _id: req.params.id, sender: me });
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });

    await Message.updateOne({ _id: msg._id }, { $addToSet: { deletedBy: me } });

    // Notificar en tiempo real que el mensaje fue borrado
    const io = req.app.get('io');
    if (io) {
      const conv = await Conversation.findById(msg.conversation);
      conv?.participants.forEach(pid => {
        io.to(`user_${pid.toString()}`).emit('message_deleted', {
          messageId:      msg._id,
          conversationId: msg.conversation,
        });
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[chat] deleteMessage:', err);
    res.status(500).json({ error: 'Error al borrar mensaje' });
  }
};