FROM node:20-bookworm-slim

# Cài đặt Python 3, FFmpeg và thư viện giải mã âm thanh hệ thống
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Tạo môi trường ảo Python và đưa vào PATH mặc định
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Cài đặt thư viện Python trước để tận dụng Docker cache
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Cài đặt thư viện Node.js
COPY package*.json ./
RUN npm ci --omit=dev

# Copy mã nguồn Backend
COPY . .

ENV NODE_ENV=production
ENV PYTHONIOENCODING=utf-8

EXPOSE 3000

CMD ["node", "src/server.js"]