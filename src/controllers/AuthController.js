const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateVerificationCode, sendVerificationEmail, send2FAEmail } = require('../config/emailConfig');
const { 
    logActivity, 
    logCreate, 
    logUpdate, 
    logLogin,
    logLogout,
    logLoginFailed,
    sanitizeObject 
} = require('../services/loggerService');

const verificationCodes = {};

// Importamos las utilidades para el usuario
const { calculateAge, normalizeRole, isEmailValid, isPasswordStrong } = require('../utils/userUtils');

const signup = async (req, res) => {
    try {
        let { email, password, fullname, id_number, id_type, date_of_birth, role = "ADMINISTRADOR", gender, phone, address, city, blood_type } = req.body;

        // Validar campos obligatorios
        if (!email || !password || !fullname || !id_number || !id_type || !date_of_birth) {
            return res.status(400).json({ 
                message: "Faltan datos obligatorios", 
                required: ["email", "password", "fullname", "id_number", "id_type", "date_of_birth"] 
            });
        }

        // Normalizar campos
        email = email.toLowerCase().trim();
        id_type = id_type.toUpperCase().trim();
        const normalizedRole = normalizeRole(role);
        if (!normalizedRole) {
            return res.status(400).json({ 
                message: "Rol no válido", 
                validRoles: ["ADMINISTRADOR", "MEDICO", "ENFERMERO", "PACIENTE"] 
            });
        }
        role = normalizedRole;

        // Validar formato de email usando la función de userUtils
        if (!isEmailValid(email)) {
            return res.status(400).json({ message: "El correo electrónico no es válido" });
        }

        // Validar contraseña usando la función de userUtils
        if (!isPasswordStrong(password)) {
            return res.status(400).json({
                message: "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"
            });
        }

        // Validar tipo de documento
        const validIdTypes = ["CC", "TI", "CE", "PP", "NIT"];
        if (!validIdTypes.includes(id_type)) {
            return res.status(400).json({ 
                message: "Tipo de documento no válido", 
                validTypes: validIdTypes 
            });
        }

        // Validar fecha de nacimiento
        const birthDate = new Date(date_of_birth);
        if (isNaN(birthDate.getTime())) {
            return res.status(400).json({ message: "Formato de fecha de nacimiento inválido" });
        }

        // Calcular edad
        const age = calculateAge(birthDate);
        if (age < 0) {
            return res.status(400).json({ message: "Fecha de nacimiento inválida" });
        }

        // Verificar si ya existe el email o el número de identificación
        const existingUser = await prisma.users.findFirst({
            where: {
                OR: [
                    { email },
                    { id_number }
                ]
            },
            select: { email: true, id_number: true }
        });

        if (existingUser) {
            const field = existingUser.email === email ? "correo electrónico" : "número de identificación";
            return res.status(400).json({ message: `El ${field} ya está registrado` });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generar código de verificación (24 horas)
        const verificationCode = generateVerificationCode();
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);

        // Preparar datos para creación de usuario
        const userData = {
            email,
            password: hashedPassword,
            fullname,
            id_number,
            id_type,
            date_of_birth: birthDate,
            age,
            role,
            status: "PENDING",
            verificationCode,
            verificationCodeExpires: verificationExpires
        };

        // Agregar campos opcionales si están presentes
        if (gender) userData.gender = gender.toUpperCase();
        if (phone) userData.phone = phone;
        if (address) userData.address = address;
        if (city) userData.city = city;
        if (blood_type) userData.blood_type = blood_type.toUpperCase();

        // Guardar en la base de datos
        const newUser = await prisma.users.create({
            data: userData
        });
        
        // Registrar la creación del usuario
        await logCreate('User', sanitizeObject(newUser), { id: 'system', email: 'system', fullname: 'Sistema' }, req, `Registro de usuario: ${email} con rol ${role}`);

        // Enviar correo de verificación (24 horas de expiración)
        const emailResult = await sendVerificationEmail(email, fullname, verificationCode, 24);
        if (!emailResult.success) {
            // Si falla el envío de correo, eliminar el usuario creado
            await prisma.users.delete({ where: { id: newUser.id } });
            return res.status(500).json({ message: "Error al enviar el correo de verificación" });
        }

        return res.status(201).json({
            message: "Usuario registrado correctamente. Por favor verifica tu correo electrónico.",
            user: {
                id: newUser.id,
                email: newUser.email,
                fullname: newUser.fullname,
                status: newUser.status,
            }
        });
    } catch (error) {
        console.error("Error en signup:", error);
        return res.status(500).json({ message: "Error en el servidor" });
    }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    if (!email || !verificationCode) {
      return res.status(400).json({
        message: "Email y código de verificación son requeridos",
      });
    }

    // Buscar usuario por email
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({ message: "La cuenta ya está verificada" });
    }

    // Verificar si el código ha expirado
    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({
        message: "El código de verificación ha expirado",
      });
    }

    // Verificar el código
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        message: "Código de verificación incorrecto",
      });
    }

    // Activar la cuenta
    const updatedUser = await prisma.users.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        verificationCode: null,
        verificationCodeExpires: null,
      },
    });

    //Registrar activacion de cuenta
    await logUpdate(
      'User',
      sanitizeObject({...user, status: 'PENDING'}),
      sanitizeObject(updatedUser),
      { id: updatedUser.id, email: updatedUser.email, fullname: updatedUser.fullname },
      req,
      "Usuario verificó su email y activó su cuenta"
    );

    return res.status(200).json({
      message: "Email verificado exitosamente. Tu cuenta está ahora activa. Por favor, inicia sesión para acceder.",
      accountActivated: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullname: updatedUser.fullname,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email es requerido" });
    }

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    if (user.status === "ACTIVE") {
      return res.status(400).json({ message: "La cuenta ya está verificada" });
    }

    // Generar nuevo código
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date();
    verificationExpires.setMinutes(verificationExpires.getMinutes() + 15);

    // Actualizar usuario con nuevo código
    await prisma.users.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationCodeExpires: verificationExpires,
      },
    });

    // Enviar nuevo email
    const emailResult = await sendVerificationEmail(
      email,
      user.fullname,
      verificationCode,
      10
    );

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Error enviando email de verificación",
      });
    }

    return res.status(200).json({
      message: "Nuevo código de verificación enviado a tu email",
    });
  } catch (error) {
    console.error("Error en resendVerificationCode:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
    });
  }
};

const signin = async (req, res) => {

  console.log('✅ Entró al controlador signin');  

  try {
    const { email, password } = req.body;
    console.log("📧 Email recibido:", email);

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      console.log("❌ Usuario no encontrado");
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    console.log("✅ Usuario encontrado:", user.email);
    // (aquí tu lógica para comparar contraseñas, generar token, etc.)

  } catch (error) {
    console.error("💥 Error en signin:", error);
    return res.status(500).json({ message: "Error interno en el servidor", error: error.message });
  }
  
  try {
    let { email, password, verificationCode } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email y contraseña son obligatorios" });
    }
    
    email = email.toLowerCase().trim();
    
    // Buscar usuario por email
    const user = await prisma.users.findUnique({
      where: { email }
    });
    
    if (!user) {
      // Registrar intento fallido de inicio de sesión
      await logLoginFailed(email, req, `Usuario no encontrado: ${email}`);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Validar si el usuario está deshabilitado por el administrador

    if (user.status === "DISABLED") {
      return res.status(403).json({
        message: "Tu cuenta ha sido deshabilitada por el administrador. Comunícate con soporte para reactivarla.",
      //  code: "ACCOUNT_DISABLED"
      });
    }

    if (user.status === "PENDING") {
      return res.status(403).json({
        message: "Tu cuenta aún no está activa. Verifica tu correo electrónico para completar la activación.",
        requiresVerification: true,
        verificationType: "EMAIL",
       // code: "ACCOUNT_PENDING"
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Tu cuenta no está disponible actualmente. Contacta al administrador.",
       // code: "ACCOUNT_UNKNOWN_STATUS"
      });
    }


    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

     // Cargar afiliaciones
    const affiliations = await prisma.userDeptRoles.findMany({
      where: { userId: user.id },
      select: { departmentId: true, specialtyId: true }
    });

    // Derivar deptIds (si specialtyId está, igual ya guardas departmentId; si no, busca)
    const deptIds = [...new Set(affiliations.map(a => a.departmentId))];
    const specialtyIds = affiliations.filter(a => a.specialtyId).map(a => a.specialtyId);
    
    // Si el usuario proporciona un código de verificación, validar 2FA
    if (verificationCode) {
      const storedVerificationData = verificationCodes[email];
      
      if (!storedVerificationData || storedVerificationData.code !== verificationCode) {
        return res.status(401).json({ message: "Código de verificación inválido" });
      }
      
      // Verificar si el código ha expirado (10 minutos)
      const now = new Date();
      if (now - storedVerificationData.timestamp > 10 * 60 * 1000) {
        delete verificationCodes[email];
        return res.status(401).json({ message: "El código de verificación ha expirado" });
      }
      
      // Código válido, eliminar del almacén temporal
      delete verificationCodes[email];
      
      // Generar JWT con información del usuario
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          fullname: user.fullname,
          role: user.role ,
          deptIds,
          specialtyIds
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Registrar inicio de sesión
      await logActivity({
        action: "INICIO_SESION",
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.fullname,
        details: `Inicio de sesión exitoso con rol: ${user.role}`,
        req
      });
      
      return res.status(200).json({
        message: "Autenticación exitosa",
        token,
        user: {
          id: user.id,
          email: user.email,
          fullname: user.fullname,
          role: user.role
        }
      });
    } else {
      // Primera fase: enviar código de verificación 2FA
      const code = generateVerificationCode();
      
      // Guardar el código temporalmente
      verificationCodes[email] = {
        code: code,
        timestamp: new Date()
      };
      
      // Registrar intento de inicio de sesión (requiere 2FA)
      await logActivity({
        action: "2FA_REQUIRED",
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.fullname,
        details: `Código de verificación 2FA enviado para: ${email}`,
        req
      });
      
      // Enviar email con el código de 2FA
      await send2FAEmail(email, user.fullname, code);
      
      return res.status(200).json({
        message: "Código de verificación enviado al email",
        requiresVerification: true,
        verificationType: "2FA",
        step: "2FA"
      });

      
    }
    
  } catch (error) {
    console.error("Error en signin:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }

  
};

const logout = async (req, res) => {
  try {
    // Registrar actividad de cierre de sesión
    await logLogout(req.user, req);
    
    return res.status(200).json({ message: "Cierre de sesión exitoso" });
  } catch (error) {
    console.error("Error en logout:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};



module.exports = { 
  signup, 
  signin, 
  resendVerificationCode, 
  verifyEmail,
  logout,
  prisma
};