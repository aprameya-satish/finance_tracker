FROM python:3.12-slim

WORKDIR /app
COPY backend /app/backend
COPY .env.example /app/.env.example

WORKDIR /app/backend
RUN pip install --no-cache-dir .

ENV HOST=0.0.0.0
ENV PORT=8000
WORKDIR /app

EXPOSE 8000
CMD ["sh", "-c", "uvicorn --app-dir backend app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
