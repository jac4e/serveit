FROM node:16-bullseye-slim

RUN mkdir /spendit
WORKDIR /spendit

RUN npm install -g @angular/cli@14.2.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN ng build --progress

ENV NODE_ENV=production

WORKDIR /spendit/server

RUN npm ci

ENV CI=1

CMD ["node", "index.js"]