//랭킹보드 관련 API
const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/leaderboard (랭킹 가져오기)
router.get('/', async (req, res) => {
  try {
    const leaderboardData = await pool.query(
      `SELECT u.nickname, qr.score, qr.submitted_at
       FROM quiz_results qr
       JOIN users u ON qr.user_id = u.id
       ORDER BY qr.score DESC, qr.submitted_at ASC
       LIMIT 100` // 상위 100명만
    );
    res.json(leaderboardData.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;