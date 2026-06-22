FROM node:20-slim
WORKDIR /app
COPY server.js index.html package.json ./
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server.js"]
