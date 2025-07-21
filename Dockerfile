FROM node:22 as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --omit=dev
EXPOSE 3443
CMD ["npm", "run", "start"]