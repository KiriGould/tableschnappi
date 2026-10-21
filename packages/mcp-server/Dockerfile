FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json    ./packages/backend/
COPY packages/frontend/package.json   ./packages/frontend/
COPY packages/mcp-server/package.json ./packages/mcp-server/
# NOTE: devDependencies are deliberately kept. CMD below runs the TypeScript
# source through tsx, which is a devDependency — adding --omit=dev here makes
# the container fail at startup with "Cannot find package 'tsx'".
RUN npm ci -w packages/mcp-server --include-workspace-root
COPY packages/mcp-server/src ./packages/mcp-server/src
COPY packages/mcp-server/tsconfig.json ./packages/mcp-server/

RUN chown -R 1001:0 /app && chmod -R g=u /app
EXPOSE 3000
USER 1001
CMD ["node", "--import=tsx/esm", "packages/mcp-server/src/index.ts"]
