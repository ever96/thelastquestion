FROM node:18-alpine

WORKDIR /app

# Copia package.json desde el contexto actual
COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]