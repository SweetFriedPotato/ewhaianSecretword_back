//랭킹보드 관련 API
const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/leaderboard (랭킹 가져오기)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nickname, qr.score, qr.duration, qr.submitted_at, qr.id as quiz_result_id
       FROM quiz_results qr
       JOIN users u ON qr.user_id = u.id
       ORDER BY qr.score DESC, qr.duration ASC, qr.submitted_at ASC`
    );

    // 사용자별 최고 기록만 남기기
    const userMap = new Map();
    for (const row of rows) {
      if (!userMap.has(row.id) || row.score > userMap.get(row.id).score) {
        userMap.set(row.id, row);
      }
    }

    const formattedData = Array.from(userMap.values())
      .sort((a, b) => b.score - a.score || a.duration - b.duration)
      .slice(0, 100)
      .map(row => ({
        id: row.quiz_result_id,
        user: {
          id: row.id,
          nickname: row.nickname
        },
        score: row.score,
        duration: row.duration,
        created_at: row.submitted_at
      }));

    res.json(formattedData);
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
