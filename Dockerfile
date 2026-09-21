FROM node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS client
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
RUN npm ci --no-audit --no-fund
COPY apps/client apps/client
RUN npm run build && test -s dist/index.html

FROM python:3.14-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATABASE_PATH=/app/data/reprep.sqlite3
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home reprep && mkdir data && chown reprep:reprep data
COPY apps/server apps/server
COPY apps/__init__.py apps/__init__.py
COPY scripts/check_public.py scripts/check_public.py
COPY --from=client /build/dist dist
USER reprep
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ready',timeout=2)"
CMD ["uvicorn","apps.server.main:app","--host","0.0.0.0","--port","8000","--workers","1"]
