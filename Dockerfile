# syntax=docker/dockerfile:1

# Build stage: compile TypeScript to dist
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: minimal, production deps only
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=streamable-http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3333 \
    MCP_HTTP_PATH=/mcp

# Install prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# Bring in compiled app and schemas
COPY --from=build /app/dist ./dist
COPY mcp_tool_schemas.json ./mcp_tool_schemas.json

EXPOSE 3333
CMD ["node", "dist/src/mcp/server.js"]
