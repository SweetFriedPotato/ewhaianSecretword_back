//랭킹보드 관련 API
const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/leaderboard (랭킹 가져오기)
router.get('/', async (req, res) => {
  try {
    // 각 사용자의 최고 기록만 가져오기
    const leaderboardData = await pool.query(
      `SELECT DISTINCT ON (u.id)
        u.id,
        u.nickname,
        qr.score,
        qr.duration,
        qr.created_at,
        qr.id as quiz_result_id
       FROM quiz_results qr
       JOIN users u ON qr.user_id = u.id
       ORDER BY u.id, qr.score DESC, qr.duration ASC, qr.created_at ASC`
    );
    
    // 점수 기준으로 다시 정렬 (사용자별 중복 제거 후)
    const sortedData = leaderboardData.rows.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // 점수 높은 순
      }
      if (a.duration !== b.duration) {
        return a.duration - b.duration; // 소요시간 짧은 순
      }
      return new Date(a.created_at) - new Date(b.created_at); // 제출시간 빠른 순
    });
    
    // 상위 100명만 선택
    const top100 = sortedData.slice(0, 100);
    
    // 사용자 정보를 포함한 형태로 변환
    const formattedData = top100.map(row => ({
      id: row.quiz_result_id,
      user: {
        id: row.id,
        nickname: row.nickname
      },
      score: row.score,
      duration: row.duration,
      created_at: row.created_at
    }));
    
    res.json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;