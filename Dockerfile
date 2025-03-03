FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Default environment
ENV NODE_ENV=production
ENV PORT=3000
ENV RABBITMQ_URL=amqp://rabbitmq

# Expose the application port
EXPOSE 3000

# Default command runs the API server
CMD ["node", "index.js"]
