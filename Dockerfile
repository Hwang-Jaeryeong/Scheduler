# Node.js 이미지 사용
FROM node:18

# 앱 디렉터리 설정
WORKDIR /usr/src/app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 코드 복사
COPY . .

# 애플리케이션 실행 포트 노출
EXPOSE 3000

# 서버 시작
CMD ["npm", "start"]
