FROM node:18-alpine

WORKDIR /app

# Copia los archivos de dependencias
COPY backend/package*.json ./

# Instala las dependencias
RUN npm install --omit=dev

# Copia el resto del código del backend
COPY backend/ .

EXPOSE 3000

CMD ["npm", "start"]