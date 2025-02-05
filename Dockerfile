# ✅ 1️⃣ 빌드 단계 (용량을 줄이기 위해 node:18-alpine 사용)
FROM node:18-alpine AS builder

# WORKDIR /app
WORKDIR /app

# 한국 시간대 설정
ENV TZ=Asia/Seoul
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone

RUN apk add --no-cache python3 py3-pip make g++
# ✅ 패키지 설치 (빌드에 필요한 모든 의존성 포함)
COPY package*.json ./
RUN npm install

# ✅ 애플리케이션 코드 복사 후 빌드
COPY . .
RUN npm run build

# ✅ 불필요한 의존성 제거 (production 전환)
RUN npm prune --production

# ✅ 2️⃣ 실행 단계 (최소한의 파일만 포함)
FROM node:18-alpine

# ✅ 시간대 설정을 실행 컨테이너에서도 유지
ENV TZ=Asia/Seoul
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone

# ✅ 빌드 결과물만 복사 (용량 최적화)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# ✅ 포트 노출
EXPOSE 3000

# ✅ 앱 실행 (메모리 최적화 옵션 포함)
CMD ["node", "--max-old-space-size=16000", "dist/server.js"]
