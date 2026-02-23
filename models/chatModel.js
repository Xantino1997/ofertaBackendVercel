// models/Chat.js
const mongoose = require('mongoose');

// ════════════════════════════════════════════════
//  CONVERSATION
//  Una conversación entre exactamente 2 usuarios
// ════════════════════════════════════════════════
const conversationSchema = new mongoose.Schema(
  {
    // Los dos participantes (User IDs — el dueño del negocio también es User)
    participants: [
      {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true,
      },
    ],

    // Referencia al último mensaje para mostrar en el sidebar
    lastMessage: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Message',
      default: null,
    },

    // Soft-delete por usuario: si el ID del user está aquí, no ve la conv
    // pero el otro participante sí la sigue viendo
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],
  },
  { timestamps: true }   // createdAt, updatedAt — updatedAt se actualiza al enviar msgs
);

// Índice compuesto para buscar rápido "convs donde participo"
conversationSchema.index({ participants: 1, updatedAt: -1 });

// ════════════════════════════════════════════════
//  MESSAGE
//  Cada mensaje dentro de una conversación
// ════════════════════════════════════════════════
const messageSchema = new mongoose.Schema(
  {
    // A qué conversación pertenece
    conversation: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Conversation',
      required: true,
    },

    // Quién lo envió
    sender: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // Contenido: texto y/o imagen (al menos uno debe existir)
    text:  { type: String,  default: ''   },
    image: { type: String,  default: null },  // URL local o Cloudinary

    // IDs de usuarios que ya leyeron el mensaje
    // El emisor se agrega automáticamente al crear el mensaje
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    // Soft-delete por usuario (igual que Conversation)
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],
  },
  { timestamps: true }
);

// Índice para cargar mensajes de una conv ordenados por fecha (más común)
messageSchema.index({ conversation: 1, createdAt: 1 });

// ════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════
// Usamos mongoose.models.X || mongoose.model(X) para compatibilidad con
// Next.js hot-reload que re-ejecuta los módulos en desarrollo
const Conversation = mongoose.models.Conversation
  || mongoose.model('Conversation', conversationSchema);

const Message = mongoose.models.Message
  || mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };