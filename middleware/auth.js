// middleware/auth.js
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 요청 객체에 사용자 정보를 추가
    next(); // 검문 통과, 다음 단계로 이동
  } catch (error) {
    res.status(401).json({ message: '인증이 필요합니다.' });
  }
};

module.exports = auth;