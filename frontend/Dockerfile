# === Build stage ===
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies separately for better caching
COPY package*.json ./
RUN npm install

# Copy source and build optimized production bundle
COPY . .
RUN npm run build

# === Serve stage ===
FROM nginx:1.27-alpine

# Copy build artifacts from the builder stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy a default Nginx config (optional — for proxy /ws/tunnel, see below)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
