// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db'); // db.js 가져오기

// 라우터 가져오기
const userRoutes = require('./routes/users');
const quizRoutes = require('./routes/quiz');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const port = process.env.PORT || 3001;

// 미들웨어 설정
const corsOptions = {
  origin: ['http://ewhasecret.com', 'http://www.ewhasecret.com', 'https://ewhasecret.com', 'https://www.ewhasecret.com'], // 허용할 프론트엔드 도메인 목록
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json()); // JSON 요청 본문 파싱

// API 라우트 설정
app.use('/api/users', userRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 기본 및 DB 테스트 라우트
app.get('/', (req, res) => {
  res.send('이화이언 퀴즈 백엔드 서버입니다! 🌸');
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: '✅ DB 연결 성공!', dbTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ message: '❌ DB 연결 실패' });
  }
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});