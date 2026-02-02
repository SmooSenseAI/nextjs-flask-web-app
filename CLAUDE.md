# Next.js + Flask Web App Template

## Project Overview
A minimal, production-grade template for building web applications with Next.js frontend and Flask backend. The frontend is compiled and bundled into the Flask Python package so it can be released as a Python package, CLI tool, or deployed on web servers.

## Tech Stack
- **Frontend**: Next.js 15, React 19, Redux Toolkit, Tailwind CSS v4, shadcn/ui
- **Backend**: Flask 3.x, Python 3.10+
- **Build**: pnpm (frontend), uv (Python), Make (orchestration)

## Project Structure
```
.
├── gui/                    # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   └── lib/           # Redux store, hooks, utils
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── Makefile
├── server/                 # Flask backend
│   ├── app/
│   │   ├── __init__.py    # App factory
│   │   ├── cli.py         # CLI commands
│   │   ├── handlers/      # API blueprints
│   │   └── statics/       # Bundled frontend (generated)
│   ├── pyproject.toml
│   └── Makefile
├── Makefile               # Root build orchestration
└── CLAUDE.md              # This file
```

## Development Workflow

### Setup
```bash
make setup                 # Install all dependencies
```

### Development
```bash
make dev                   # Run both frontend and backend dev servers
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### Build
```bash
make build                 # Build frontend + bundle into Python package
```

### Run Production
```bash
cd server && uv run webapp serve
# or after pip install:
webapp serve
```

## Key Patterns

### API Communication
- Dev: Next.js rewrites `/api/*` to Flask at `localhost:8000`
- Prod: Flask serves both static files and API from single server

### State Management
- Redux Toolkit with typed hooks
- Feature-based slice organization in `gui/src/lib/features/`

### UI Components (shadcn/ui)
- Components in `gui/src/components/ui/`
- Built on Radix UI primitives
- Styled with Tailwind CSS
- Theme colors defined in `gui/src/app/globals.css` using oklch format
- Dark mode via `next-themes` with class-based switching

### CLI
- Click-based CLI in `server/app/cli.py`
- Entry point: `webapp` command

## Build Targets
1. **Python Package**: `pip install .` or `uv build`
2. **CLI Tool**: `webapp serve`, `webapp --version`
3. **Web Deployable**: Static export bundled in package

## Common Commands
```bash
# Frontend
cd gui && pnpm dev         # Dev server
cd gui && pnpm build       # Production build
cd gui && pnpm lint        # Lint check
cd gui && pnpm typecheck   # TypeScript check

# Backend
cd server && make dev      # Flask dev server
cd server && make test     # Run tests
cd server && make lint     # Lint + format check
cd server && uv build      # Build package
```

## Adding New Features

### New API Endpoint
1. Create handler in `server/app/handlers/`
2. Register blueprint in `server/app/__init__.py`

### New Frontend Page
1. Create page in `gui/src/app/`
2. Add Redux slice if needed in `gui/src/lib/features/`

### New CLI Command
1. Add to `server/app/cli.py`

### New UI Component
1. Add component to `gui/src/components/ui/`
2. Use Radix UI primitives + Tailwind CSS
3. Export from component file
