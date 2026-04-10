require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const fs = require('fs');

// Connect to database
connectDB();

const app = express();

const path = require('path');

// Автоматичне створення папки uploads, якщо її не існує
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Вимкнено для inline-скриптів Tailwind CDN
    crossOriginEmbedderPolicy: false
}));

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5001', 'http://localhost:3000', 'http://localhost:5500'];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS not allowed'));
    },
    credentials: true
}));
app.use(express.json());

// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/document-types', require('./routes/documentTypeRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/saved-filters', require('./routes/savedFilterRoutes'));
app.use('/api/delegations', require('./routes/delegationRoutes'));

// Обробник 404 помилок (щоб сервер повертав JSON замість HTML сторінки)
app.use((req, res, next) => {
  res.status(404).json({ message: `Маршрут не знайдено: ${req.method} ${req.originalUrl}` });
});

// Глобальний обробник помилок (щоб Multer та інші помилки повертали JSON)
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Внутрішня помилка сервера' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
