require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
app.use(cors());
app.use(express.json());

// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('EDMS API is running...');
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/document-types', require('./routes/documentTypeRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

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
