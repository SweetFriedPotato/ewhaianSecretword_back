# Ewhaian Secretword Backend

## 🚀 다른 서버에서 실행하는 방법

### 1. 사전 준비
- Docker와 Docker Compose가 설치되어 있어야 합니다
- Git이 설치되어 있어야 합니다

### 2. 프로젝트 클론
```bash
git clone <repository-url>
cd ewhaianSecretword_back
```

### 3. 환경 변수 설정
```bash
# .env 파일 생성 (예제 파일 복사)
cp .env.example .env

# 필요시 .env 파일 수정
nano .env  # 또는 vim .env
```

### 4. Docker Compose로 실행
```bash
# 모든 서비스 (백엔드 + 데이터베이스) 실행
docker-compose -f docker-compose.prod.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 상태 확인
docker-compose -f docker-compose.prod.yml ps
```

### 5. 서비스 접속
- 백엔드 API: http://localhost:3001
- PostgreSQL DB: localhost:5432

### 6. 서비스 중지
```bash
# 모든 서비스 중지
docker-compose -f docker-compose.prod.yml down

# 데이터베이스 볼륨까지 삭제 (모든 데이터 삭제)
docker-compose -f docker-compose.prod.yml down -v
```

## 📝 주요 명령어

```bash
# 서비스 재시작
docker-compose -f docker-compose.prod.yml restart

# 특정 서비스만 재시작
docker-compose -f docker-compose.prod.yml restart backend

# 데이터베이스 접속
docker exec -it ewhaian-db psql -U postgres -d mydb
```

## 🔧 트러블슈팅

### 포트가 이미 사용 중인 경우
```bash
# 사용 중인 포트 확인
sudo lsof -i :3001
sudo lsof -i :5432

# 기존 컨테이너 정리
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
```

### 데이터베이스 초기화
```bash
# 볼륨 삭제 후 재실행
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build
```
