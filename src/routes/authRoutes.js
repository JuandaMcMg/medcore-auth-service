
const authController = require('../controllers/AuthController');
const express = require('express');
const router = express.Router();
const verifyJWT = require('../middlewares/authMiddleware');
const { sendVerificationEmail, send2FAEmail } = require('../config/emailConfig');


//http://localhost:3002/api/v1/auth/health
router.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    ts: new Date().toISOString(),
    service: "auth-service",
    endpoint: "/api/v1/auth/health"
  });
});

//http://localhost:3002/api/v1/auth/sign-up
router.post('/sign-up', authController.signup);

//http://localhost:3002/api/v1/auth/sign-in
router.post('/sign-in', authController.signin);

//http://localhost:3002/api/v1/auth/verify-email
router.post('/verify-email', authController.verifyEmail);

//http://localhost:3002/api/v1/auth/resend-verification
router.post('/resend-verification', authController.resendVerificationCode);

//http://localhost:3002/api/v1/auth/logout
router.post('/logout', verifyJWT, authController.logout);

// POST http://medcore-auth-service:3002/api/v1/auth/send-verification
console.log('[routes] sendVerificationForUserMgmt type =', typeof authController.sendVerificationForUserMgmt);
router.post('/send-verification', authController.sendVerificationForUserMgmt);

module.exports = router;
