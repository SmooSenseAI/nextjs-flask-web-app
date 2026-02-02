.PHONY: setup dev build clean

# Setup all dependencies
setup:
	make -C gui setup
	make -C server setup

# Run development servers (frontend + backend)
dev:
	make -C gui dev

# Build frontend and bundle into Python package
build:
	make -C gui build
	rm -rf server/app/statics
	cp -r gui/dist server/app/statics
	make -C server build

# Clean all build artifacts
clean:
	make -C gui clean
	make -C server clean
