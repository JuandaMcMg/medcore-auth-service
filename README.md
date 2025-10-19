# MedCore Auth Service

Este microservicio gestiona la autenticación y autorización para el sistema MedCore, incluyendo registro de usuarios, inicio de sesión, y verificación de tokens.

## Características

- Registro de usuarios
- Autenticación con JWT
- Verificación de correo electrónico
- Recuperación de contraseña
- Validación de tokens

## Tecnologías

- Node.js
- Express
- MongoDB (con Prisma ORM)
- JWT (JSON Web Tokens)
- Nodemailer (para envío de correos)

## Requisitos

- Node.js 14.x o superior
- MongoDB
- NPM o Yarn

## Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd auth-service
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar Prisma:
```bash
npx prisma generate
```

4. Crear archivo `.env` con las siguientes variables:
```
PORT=3002
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_FROM=noreply@medcore.com
FRONTEND_URL=http://localhost:3000
```

5. Iniciar el servicio:
```bash
npm run dev
```

## Despliegue en Vercel

1. Asegúrate de tener una cuenta en [Vercel](https://vercel.com/) y el CLI instalado:
```bash
npm i -g vercel
```

2. Iniciar sesión en Vercel:
```bash
vercel login
```

3. Configurar variables de entorno en Vercel:
   - Ve a la configuración de tu proyecto en Vercel
   - Añade las variables de entorno mencionadas en el archivo `.env`

4. Desplegar el servicio:
```bash
vercel --prod
```

## Estructura del Proyecto

- `src/index.js`: Punto de entrada de la aplicación
- `src/controllers/`: Controladores para manejar la lógica de autenticación
- `src/routes/`: Definiciones de rutas
- `src/middlewares/`: Middleware de autenticación, validación, etc.
- `prisma/`: Esquemas de Prisma para la base de datos

## API Endpoints

- `POST /api/auth/register`: Registro de usuario
- `POST /api/auth/login`: Inicio de sesión
- `GET /api/auth/verify`: Verificación de token JWT
- `POST /api/auth/verify-email/:token`: Verificación de correo electrónico
- `POST /api/auth/forgot-password`: Solicitud de restablecimiento de contraseña
- `POST /api/auth/reset-password/:token`: Restablecimiento de contraseña