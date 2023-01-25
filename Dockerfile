FROM node:latest

COPY --from=ghcr.io/ixofoundation/ixo-blockchain:debug /bin/ixod /bin/ixod
COPY --from=ghcr.io/ixofoundation/ixo-blockchain:debug /go/pkg/mod/github.com/!cosm!wasm/wasmvm@v1.1.1/internal/api/ /go/pkg/mod/github.com/!cosm!wasm/wasmvm@v1.1.1/internal/api/
COPY --from=ghcr.io/ixofoundation/ixo-blockchain:debug /lib/x86_64-linux-gnu/libgcc_s.so.1 /lib/x86_64-linux-gnu/libgcc_s.so.1

WORKDIR /app

COPY package*.json ./

RUN yarn install

COPY . .

RUN yarn build 

CMD ["yarn","start:prod"]
