.PHONY: setup dev build clean lint typecheck unittest test

setup:
	pnpm install

dev:
	@echo ""
	@echo "🚀 Open http://localhost:3000"
	@echo ""
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

typecheck:
	pnpm typecheck

unittest:
	pnpm test

test: typecheck lint unittest

clean:
	rm -rf dist .next node_modules
