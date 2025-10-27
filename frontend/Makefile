# --- Config ---
SERVICE_NAME := tfm-frontend-1
IMAGE_NAME   := frontend
PORT         := 8088

.PHONY: help
help:
	@echo ""
	@echo "Frontend Makefile Commands"
	@echo "-------------------------"
	@echo "make dev      - Run CRA dev server (hot reload)"
	@echo "make build    - Build production static files"
	@echo "make image    - Build Docker image (Nginx serving build)"
	@echo "make up       - Run Nginx container on :$(PORT)"
	@echo "make down     - Stop running container"
	@echo "make clean    - Stop container + remove image"
	@echo "make logs     - Follow Nginx logs"
	@echo "make open     - Open app in browser"
	@echo ""

# Dev (no Docker)
.PHONY: dev
dev:
	npm start

# Build static files
.PHONY: build
build:
	npm run build

# Build Docker image
.PHONY: image
image: build
	docker build -t $(IMAGE_NAME) .

# Run Nginx container serving the build
.PHONY: up
up: image
	docker run -d --name $(SERVICE_NAME) --network tfm_default -p $(PORT):80 $(IMAGE_NAME)


# Stop container
.PHONY: down
down:
	- docker stop $(SERVICE_NAME) >/dev/null 2>&1 || true

# Stop container + remove image
.PHONY: clean
clean: down
	- docker rmi $(IMAGE_NAME) >/dev/null 2>&1 || docker container prune --force || true
	@echo "✅ Cleaned"

# Logs
.PHONY: logs
logs:
	docker logs -f $(SERVICE_NAME)

# Open browser
.PHONY: open
open:
	xdg-open http://localhost:$\(PORT\) 2>/dev/null || open http://localhost:$\(PORT\) 2>/dev/null || echo "Open http://localhost:$(PORT)"
