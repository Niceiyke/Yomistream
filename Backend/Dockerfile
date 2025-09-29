FROM python:3.12-slim

# Install system dependencies for audio/video processing and other tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       ffmpeg \
       git \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt ./
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app

# Ensure uploads and other runtime dirs exist
RUN mkdir -p /app/downloads /app/transcripts

# Expose the port used by the app (default from config.py is 6000)
EXPOSE 6000

# Use a non-root user for better security
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

# Default environment variables (can be overridden by Docker run or CI)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Start the app with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
