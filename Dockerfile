# Imagem do app Streamlit, executada pelo Cloudflare Containers (ver wrangler.jsonc).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py ./
COPY core/ core/
COPY views/ views/
COPY src/assets/ src/assets/
COPY .streamlit/config.toml .streamlit/config.toml

# SUPABASE_URL e SUPABASE_ANON_KEY chegam como variáveis de ambiente, enviadas pelo Worker.
EXPOSE 8501
CMD ["streamlit", "run", "app.py", \
     "--server.address=0.0.0.0", "--server.port=8501", "--server.headless=true"]
