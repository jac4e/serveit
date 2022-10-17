FROM node:16-bullseye-slim

ENV CI=1

RUN apt-get update && apt-get install -y gettext

RUN mkdir /src
WORKDIR /src

RUN npm install -g @angular/cli@14.2.1
RUN npm install -g nodemon

CMD ["tail", "-f", "/dev/null"]