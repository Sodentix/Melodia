FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Ensure assets exist (clips, avatars)
RUN mkdir -p assets/clips assets/avatars

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
