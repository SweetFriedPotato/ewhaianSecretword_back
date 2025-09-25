//퀴즈 문제 제공, 정답 제출 등 퀴즈 관련 API
const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../db');
const questions = require('../quizdata');

const router = express.Router();

// GET /api/quiz/questions (문제 목록 가져오기 - 힌트만)
router.get('/questions', auth, (req, res) => {
  const hints = questions.map(({ hint }) => ({ hint }));
  res.json(hints);
});

// POST /api/quiz/submit (정답 제출 및 채점)
router.post('/submit', auth, async (req, res) => {
  const { answers } = req.body; // answers는 사용자가 제출한 답안 배열
  const userId = req.user.id;

  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return res.status(400).json({ message: '유효하지 않은 답안 형식입니다.' });
  }

  // 채점 로직
  let score = 0;
  const results = answers.map((userAnswer, index) => {
    const correctAnswers = questions[index].answers.map(a => a.toLowerCase().replace(/\s/g, ''));
    const isCorrect = correctAnswers.includes(userAnswer.toLowerCase().replace(/\s/g, ''));
    if (isCorrect) score++;
    return { question: index + 1, isCorrect };
  });

  try {
    // 이전 제출 기록 확인
    const existingResult = await pool.query('SELECT * FROM quiz_results WHERE user_id = $1', [userId]);
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ message: '이미 퀴즈를 제출했습니다.' });
    }

    // 결과 저장
    await pool.query(
      'INSERT INTO quiz_results (user_id, score, answers) VALUES ($1, $2, $3)',
      [userId, score, JSON.stringify(results)]
    );
    
    res.status(200).json({ message: '제출 완료!', score, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;