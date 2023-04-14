FROM --platform=linux/amd64 node:latest

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --pure-lockfile

COPY . .

RUN yarn build

CMD ["yarn","start:prod"]
