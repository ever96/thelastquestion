# Funciona tanto si Railway construye desde la raíz del repo
# como si "Root Directory" es "backend".
FROM node:22-alpine

WORKDIR /src
COPY . .

# Si estamos en la raíz del repo, el backend está en ./backend
RUN if [ -f backend/server.js ]; then cp -r backend /app; else mkdir -p /app && cp -r . /app; fi \
 && rm -rf /src

WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
