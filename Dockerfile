# 1. 베이스 이미지 설정 (Node.js 20 버전 사용)
FROM node:20-alpine

# 2. 작업 디렉토리 설정
WORKDIR /usr/src/app

# 3. package.json 파일들을 먼저 복사하여 의존성 설치 (캐싱 활용)
COPY package*.json ./
RUN npm install

# 4. 나머지 모든 소스 코드 복사
COPY . .

# 5. 서버가 사용할 포트 명시
EXPOSE 3001

# 6. 서버 실행 명령어
CMD ["npm", "start"]