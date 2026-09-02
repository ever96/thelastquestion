# Usar una imagen oficial y ligera de Node.js
FROM node:18-alpine

# Establecer el directorio de trabajo principal dentro del contenedor
WORKDIR /app

# Copiar exclusivamente los archivos de dependencias del backend
COPY backend/package*.json ./backend/

# Entrar a la carpeta backend e instalar únicamente las dependencias de producción
WORKDIR /app/backend
RUN npm install --production

# Copiar el resto del código fuente del backend
COPY backend/ .

# Cloud Run inyecta la variable PORT automáticamente (por defecto usa 8080)
ENV PORT=8080
EXPOSE 8080

# Comando para iniciar el servidor de Node.js
CMD ["node", "server.js"]