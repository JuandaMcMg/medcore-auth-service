# ---- build ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*

COPY package.json prisma ./
ENV NODE_ENV=production
RUN npm install

# Copia el resto (incluye /src)
COPY . .

# Limpieza: NO borres src/generated/prisma
RUN rm -rf .prisma node_modules/.prisma

# Genera el cliente hacia ../src/generated/prisma (como en tu schema)
RUN npx prisma generate

# Verificación dura: si no existe, falla el build
RUN test -f src/generated/prisma/index.js && ls -la src/generated/prisma || (echo "❌ Prisma client NO se generó en /app/src/generated/prisma" && exit 1)

# ---- runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./
CMD ["npm","run","start"]
