const express = require("express");
const database = require("./database/database");
const bodyparser = require("body-parser");
const authRoutes = require("./routes/authRoutes");
const cors = require("cors");
const helmet = require("helmet");
const { sanitizeInputs } = require("./middlewares/sanitizeMiddleware");
const { transporter } = require('./config/emailConfig');

require("dotenv").config();

const crypto = require('crypto');
const s = process.env.JWT_SECRET || '';
console.log('[BOOT][auth] JWT_SECRET len=', s.length, 'sha256=', crypto.createHash('sha256').update(s).digest('hex'));

if ((process.env.DEBUG_AUTH || 'false').toLowerCase() === 'true') {
  const s = process.env.JWT_SECRET || '';
  console.log('[AUTH][SECRET] bytes.len =', Buffer.from(s, 'utf8').length);
  console.log('[AUTH][SECRET] bytes.tail=', Buffer.from(s, 'utf8').toString('hex').slice(-16));
}


const port = process.env.PORT || 3002;

const app = express();

(async () => {
  try {
    const ok = await transporter.verify();
    console.log('[SMTP] verify =>', ok);
  } catch (e) {
    console.error('[SMTP] verify ERROR =>', e);
  }
})();

// Permitir CORS para comunicación entre microservicios
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], // Frontend y API Gateway
  //methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  //allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.get("/health", (_req, res) =>
  res.json({ 
    ok: true, 
    ts: new Date().toISOString(),
    service: "auth-service",
    port: port
  })
);

app.use(helmet()); // Añade headers de seguridad
app.use(bodyparser.json());
app.use(sanitizeInputs); // Sanitiza las entradas contra XSS
app.use('/api/v1/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Auth Service Error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: "Authentication service encountered an error",
    service: "auth-service"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not Found", 
    message: `Route ${req.originalUrl} not found in auth service`,
    service: "auth-service"
  });
});

database();

app.listen(port, () => {
  console.log(`🔐 Auth Service running on port ${port}`);
  database();
});

module.exports = app;