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

// Always allow local development URLs for debugging
const localOrigins = ['http://localhost:5001', 'http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5001', 'http://127.0.0.1:3000', 'http://127.0.0.1:5500'];
// Add any custom production origins from Render environment variables
const envOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) : [];
const allowedOrigins = [...localOrigins, ...envOrigins];

app.use(cors({
    origin: (origin, cb) => {
        // Allow requests with no origin (like same-origin requests or Postman)
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
        console.warn(`CORS blocked request from origin: ${origin}`);
        const error = new Error('CORS not allowed');
        error.status = 403;
        cb(error);
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
