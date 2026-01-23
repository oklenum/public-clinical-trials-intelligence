# Container image for the MCP server (HTTP transport)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY mcp_tool_schemas.json ./mcp_tool_schemas.json
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY mcp_tool_schemas.json ./mcp_tool_schemas.json
ENV MCP_TRANSPORT=streamable-http
ENV MCP_HTTP_PORT=3333
ENV MCP_HTTP_HOST=0.0.0.0
EXPOSE 3333
CMD ["node", "dist/src/mcp/server.js"]
