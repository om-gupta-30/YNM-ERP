IMAGE   := ynm-erp
PORT    := 8080

# ─── Setup ──────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Create .env.local from example (won't overwrite existing)
	@test -f ".env.local" \
		&& echo ".env.local already exists – skipping" \
		|| cp ".env.local.example" ".env.local" \
		&& echo "Created .env.local – fill in your Supabase keys"

# ─── Dependencies ───────────────────────────────────────────────────

.PHONY: install
install: ## Install npm dependencies
	npm install

.PHONY: ci
ci: ## Clean-install npm dependencies (CI-style)
	npm ci

# ─── Development ────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start the Next.js dev server
	npm run dev

.PHONY: build
build: ## Create a production build
	npm run build

.PHONY: start
start: ## Start the production server (run `make build` first)
	npm run start

# ─── Code Quality ──────────────────────────────────────────────────

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript compiler check (no emit)
	npx tsc --noEmit

.PHONY: check
check: typecheck lint ## Run typecheck + lint together

# ─── Database (Supabase) ───────────────────────────────────────────

.PHONY: db-migrate
db-migrate: ## Apply Supabase migrations (requires supabase CLI)
	npx supabase db push

.PHONY: db-seed
db-seed: ## Run the database seed file
	npx supabase db seed

.PHONY: db-reset
db-reset: ## Reset the local Supabase database (destructive)
	npx supabase db reset

# ─── Docker ─────────────────────────────────────────────────────────

.PHONY: docker-build
docker-build: ## Build the Docker image
	docker build \
		--build-arg NEXT_PUBLIC_SUPABASE_URL \
		--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \
		-t $(IMAGE) .

.PHONY: docker-run
docker-run: ## Run the Docker container on port $(PORT)
	docker run --rm -p $(PORT):$(PORT) \
		--env-file ".env.local" \
		$(IMAGE)

.PHONY: docker-stop
docker-stop: ## Stop all running ynm-erp containers
	@docker ps -q --filter ancestor=$(IMAGE) | xargs -r docker stop

# ─── Cleanup ────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf .next node_modules

# ─── Help ───────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
