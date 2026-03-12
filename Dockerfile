FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Second stage: production environment
FROM node:22-alpine

WORKDIR /app

# Install ffmpeg which is required for stitching audio files
RUN apk add --no-cache ffmpeg

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled source code and public assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/assets ./assets
# Also copy programs.yaml if the user has customized default programs
COPY --from=builder /app/programs.yaml ./programs.yaml

# Ensure data and output directories exist
RUN mkdir -p data output

# Expose main web server port and Subsonic API port
EXPOSE 3000
EXPOSE 4533

# Run the app
CMD ["npm", "start"]
