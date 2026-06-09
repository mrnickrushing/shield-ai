FROM python:3.12-slim

# System deps: tesseract for OCR, build tools for psycopg/bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# start.py reads $PORT in Python — no shell expansion needed.
CMD ["python", "start.py"]
