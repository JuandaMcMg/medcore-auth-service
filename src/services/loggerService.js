// Logger service para el auth-service
// Este servicio se comunica con el audit-service para registrar actividades

const logActivity = async (logData) => {
  try {
    const auditServiceUrl = process.env.AUDIT_SERVICE_URL;
    if (!auditServiceUrl) {
      console.warn('AUDIT_SERVICE_URL not configured. Skipping audit log.');
      return;
    }

    // En un entorno de producción, aquí harías una llamada HTTP al audit service
    // Por ahora, simplemente logueamos en consola
    console.log('🔍 Audit Log:', {
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      ...logData
    });
    
    // TODO: Implementar llamada HTTP al audit service
    // const response = await fetch(`${auditServiceUrl}/api/v1/audit/log`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(logData)
    // });
    
  } catch (error) {
    console.error('Error logging to audit service:', error);
  }
};

const logCreate = async (entityType, newValues, user, req, details) => {
  await logActivity({
    action: 'CREATE',
    entityType,
    entityId: newValues.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.fullname,
    newValues,
    details,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

const logUpdate = async (entityType, oldValues, newValues, user, req, details) => {
  await logActivity({
    action: 'UPDATE',
    entityType,
    entityId: newValues.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.fullname,
    oldValues,
    newValues,
    details,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

const logLogin = async (user, req) => {
  await logActivity({
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.fullname,
    details: `Successful login for user: ${user.email}`,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

const logLogout = async (user, req) => {
  await logActivity({
    action: 'LOGOUT',
    entityType: 'User',
    entityId: user.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.fullname,
    details: `User logged out: ${user.email}`,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

const logLoginFailed = async (email, req, details) => {
  await logActivity({
    action: 'LOGIN_FAILED',
    entityType: 'User',
    userEmail: email,
    details: details || `Failed login attempt for: ${email}`,
    ipAddress: req?.ip || req?.socket?.remoteAddress,
    userAgent: req?.get('User-Agent')
  });
};

// Función para sanitizar objetos removiendo campos sensibles
const sanitizeObject = (obj) => {
  if (!obj) return obj;
  
  const sensitiveFields = ['password', 'verificationCode'];
  const sanitized = { ...obj };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

module.exports = {
  logActivity,
  logCreate,
  logUpdate,
  logLogin,
  logLogout,
  logLoginFailed,
  sanitizeObject
};