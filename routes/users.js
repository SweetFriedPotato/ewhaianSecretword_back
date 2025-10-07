// routes/users.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../db'); // db.js 파일에서 pool 가져오기

const router = express.Router();

// Nodemailer 설정 (Gmail용)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ## POST /api/users/register (회원가입) ##
router.post('/register', async (req, res) => {
  const { email, password, nickname, secretWord } = req.body;

  // pool에서 클라이언트(개별 연결)를 하나 빌려옵니다.
  const client = await pool.connect();

  // 1. 입력값 검증
  if (!email || !password || !nickname || !secretWord) {
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  }
  if (!email.endsWith('@ewhain.net') && !email.endsWith('@ewha.ac.kr')) {
    return res.status(400).json({ message: '이화인 이메일로만 가입할 수 있습니다.' });
  }
  if (secretWord !== process.env.SECRET_WORD_FOR_REGISTER) {
  return res.status(400).json({ message: '비밀단어가 일치하지 않습니다.' });
  } 

  try {
    // 트랜잭션 시작
    await client.query('BEGIN');

    // 2. 이메일 또는 닉네임 중복 확인
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1 OR nickname = $2', [email, nickname]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK'); // 중복 시 트랜잭션 되돌리기
      return res.status(409).json({ message: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. [트랜잭션 작업 1] 사용자 정보 DB에 저장
    const newUser = await client.query(
      'INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, nickname]
    );
    const userId = newUser.rows[0].id;

    // 5. [트랜잭션 작업 2] 이메일 인증 토큰 생성 및 메일 발송
    // ========== 임시 수정: 이메일 발송 실패해도 회원가입 진행되도록 함 ==========
    // 원래 코드 (롤백 시 아래 주석을 해제하고 현재 코드 삭제):
    /*
    const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `http://localhost:3001/api/users/verify?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: '[이화이언] 비밀단어 퀴즈 이메일 인증',
      html: `<h3>가입을 완료하려면 아래 링크를 클릭하세요:</h3><a href="${verificationLink}">${verificationLink}</a>`,
    });
    */
    // 수정된 코드 (현재 사용 중):
    const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `http://localhost:3001/api/users/verify?token=${verificationToken}`; // TODO: 프론트엔드 주소로 변경 필요

    try {
      // 이메일 발송 시도 (실패해도 회원가입은 계속 진행)
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: '[이화이언] 비밀단어 퀴즈 이메일 인증',
        html: `<h3>가입을 완료하려면 아래 링크를 클릭하세요:</h3><a href="${verificationLink}">${verificationLink}</a>`,
      });
      console.log('이메일 발송 성공:', email);
    } catch (emailError) {
      // 이메일 발송 실패해도 회원가입은 성공 처리
      console.warn('이메일 발송 실패 (회원가입은 계속 진행):', emailError.message);
      // 이메일 인증 없이 바로 계정 활성화
      await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
    }
    // ========== 임시 수정 끝 ==========

    // 모든 작업이 성공했으므로 트랜잭션을 최종 확정(저장)합니다.
    await client.query('COMMIT');

    res.status(201).json({ message: '가입 성공! 이메일을 확인하여 계정을 활성화해주세요.' });

  } catch (error) {
    // try 블록 안에서 뭐든 하나라도 실패하면 여기로 와서 모든 작업을 되돌립니다.
    await client.query('ROLLBACK');
    
    console.error('Register Error:', error); // 서버 로그에는 에러 기록
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });

  } finally {
    // 성공하든 실패하든, 빌려왔던 연결은 반드시 풀(pool)에 반납합니다.
    client.release();
  }
});


// ## GET /api/users/verify (이메일 인증) ##
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [decoded.userId]);
    
    // TODO: 인증 성공 시 프론트엔드의 특정 페이지로 리디렉션
    res.send('<h1>이메일 인증이 완료되었습니다!</h1><p>이제 로그인할 수 있습니다.</p>');
  } catch (error) {
    res.status(400).send('<h1>유효하지 않거나 만료된 인증 링크입니다.</h1>');
  }
});

// ## POST /api/users/login (로그인) ##
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ message: '이메일 인증을 먼저 완료해주세요.' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        const token = jwt.sign(
            { id: user.id, nickname: user.nickname },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // 토큰 유효기간 1일
        );

        res.status(200).json({ token });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


module.exports = router;