VENV = backend/.venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip

.PHONY: dev dev-backend dev-frontend install install-backend install-frontend test test-backend test-frontend venv

venv:
	python3 -m venv $(VENV)

install: install-backend install-frontend

install-backend: venv
	$(PIP) install -e "backend/.[dev]"

install-frontend:
	cd frontend && npm install

dev:
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait

dev-backend:
	$(VENV)/bin/uvicorn app.main:app --reload --port 8000 --app-dir backend

dev-frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && $(PYTHON) -m pytest tests/ -v

test-frontend:
	cd frontend && npx vitest run
