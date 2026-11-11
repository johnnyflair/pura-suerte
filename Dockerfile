FROM node:22-slim
WORKDIR /app
COPY server/package*.json server/
COPY web/package*.json web/
RUN npm --prefix server ci && npm --prefix web ci
COPY . .
RUN npm --prefix web run build
ENV NODE_ENV=production
CMD ["npm", "--prefix", "server", "start"]
