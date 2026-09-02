# Usar una imagen oficial y ligera de Node.js
FROM node:18-alpine

# Crear directorio de trabajo en el contenedor
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --production

# Copiar el resto del código del backend
COPY . .

# Cloud Run inyecta la variable PORT automáticamente, por lo que usamos process.env.PORT
ENV PORT=8080
EXPOSE 8080

# Comando para iniciar el servidor
CMD ["node", "server.js"]