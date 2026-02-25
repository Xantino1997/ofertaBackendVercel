// server.js (Vercel - sin socket)
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const connectDB = require('./config/db');

const authRoutes    = require('./routes/authRoute');
const userRoutes    = require('./routes/userRoute');
const busiRoutes    = require('./routes/businessRoute');
const productRoutes = require('./routes/productRoute');
const adminRoutes   = require('./routes/adminRoute');
const cartRoutes    = require('./routes/cartRoute');
const orderRoutes   = require('./routes/orderRoute');
const chatRoutes    = require('./routes/chatRoute');
const { router: pushRoutes } = require('./routes/pushRoute');

const { startAbandonedCartJob } = require('./jobs/abandonedCartEmail');

startAbandonedCartJob();

const app = express();
connectDB();
app.get('/', (req, res) => {
  res.json({ mensaje: 'estoy aqui en vercel man' });
});
app.use(cors({
  origin: 'https://offertas.vercel.app',
  credentials: true,
}));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',     authRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/business', busiRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/push',     pushRoutes);


module.exports = app;





