const express = require("express");
const database = require("./database/database");
const bodyparser = require("body-parser");
const authRoutes = require("./routes/authRoutes");
const cors = require("cors");
const helmet = require("helmet");
const { sanitizeInputs } = require("./middlewares/sanitizeMiddleware");

require("dotenv").config();

const port = process.env.PORT || 3002;

const app = express();

// Permitir CORS para comunicación entre microservicios
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], // Frontend y API Gateway
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

app.listen(port, () => {
  console.log(`🔐 Auth Service running on port ${port}`);
  database();
});

module.exports = app;