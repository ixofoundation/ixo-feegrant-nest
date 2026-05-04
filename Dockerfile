# Stage 1: Building the code
FROM --platform=linux/amd64 node:22.16.0 AS builder

WORKDIR /src

# First, copy package.json and yarn.lock only to cache dependencies
COPY package.json yarn.lock ./

# Install dependencies based on lockfile without generating a new one
RUN yarn --pure-lockfile && yarn cache clean

# Now copy the rest of the source code
COPY . .

# Build the application
RUN yarn run build

# Install production dependencies in a separate directory
RUN mkdir /prod-deps && cp package.json yarn.lock /prod-deps/ && \
    cd /prod-deps && yarn --pure-lockfile --production && yarn cache clean

# Stage 2: Setting up the production image
FROM --platform=linux/amd64 node:22.16.0-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /src/dist /app/dist
COPY --from=builder /src/package.json /app
COPY --from=builder /prod-deps/node_modules /app/node_modules
# Migration .sql files are read at runtime when MIGRATE_DB_PROGRAMATICALLY=1.
# node-pg-migrate reads from the relative path configured in migrations.ts.
COPY --from=builder /src/src/postgres/migrations /app/src/postgres/migrations

# Run the application
CMD ["node", "dist/main"]
