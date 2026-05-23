import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../db';
import config from '../config';

const router = Router();

const createAccessToken = (user: { user_id: string; email: string; user_type: string }) => {
  return jwt.sign(
    { userId: user.user_id, email: user.email, userType: user.user_type },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

const createRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.refreshTokenExpiresIn });
};

router.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('userType').isIn(['owner', 'renter', 'both']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, userType } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
      const result = await pool.query(
        'INSERT INTO users (email, phone, password_hash, first_name, last_name, date_of_birth, user_type) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6) RETURNING user_id, email, user_type',
        [email, '', hashedPassword, firstName, lastName, userType]
      );

      const user = result.rows[0];
      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user.user_id);

      await pool.query(
        'INSERT INTO refresh_tokens (token, user_id, expires_at, revoked) VALUES ($1, $2, NOW() + INTERVAL $3, false)',
        [refreshToken, user.user_id, config.refreshTokenExpiresIn]
      );

      return res.status(201).json({ accessToken, refreshToken });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query('SELECT user_id, email, password_hash, user_type FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user.user_id);

      await pool.query(
        'INSERT INTO refresh_tokens (token, user_id, expires_at, revoked) VALUES ($1, $2, NOW() + INTERVAL $3, false)',
        [refreshToken, user.user_id, config.refreshTokenExpiresIn]
      );

      return res.json({ accessToken, refreshToken });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Login failed' });
    }
  }
);

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Missing refresh token' });
  }

  try {
    const tokenRow = await pool.query('SELECT token, user_id, revoked FROM refresh_tokens WHERE token = $1', [refreshToken]);
    if (!tokenRow.rowCount || tokenRow.rows[0].revoked) {
      return res.status(401).json({ message: 'Refresh token invalid' });
    }

    const payload = jwt.verify(refreshToken, config.jwtSecret) as { userId: string };
    const userResult = await pool.query('SELECT user_id, email, user_type FROM users WHERE user_id = $1', [payload.userId]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const accessToken = createAccessToken(user);
    return res.json({ accessToken });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Missing refresh token' });
  }

  try {
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);
    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Logout failed' });
  }
});

export default router;
