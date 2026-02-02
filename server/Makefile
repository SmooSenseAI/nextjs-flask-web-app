.PHONY: setup dev build clean lint test

setup:
	uv sync

dev:
	FLASK_DEBUG=1 uv run python -m app.dev

build:
	uv build

lint:
	uv run ruff check .
	uv run ruff format --check .

format:
	uv run ruff format .

test:
	uv run pytest

clean:
	rm -rf dist build *.egg-info .venv __pycache__ .pytest_cache .mypy_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
