const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { pool, jwtSecret } = require('../config');

const {
    authenticateJWT,
    validateAdminSecret
} = require('../middleware/auth.middleware');

const router = express.Router();

// STUDENT REGISTRATION
router.post('/register', async (req, res, next) => {
    const { fullName, email, password, school } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Full name, email, and password are required.'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existing = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRes = await client.query(
            `INSERT INTO users
                (email, password_hash, role, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, role, status`,
            [normalizedEmail, hashedPassword, 'student', 'active']
        );

        const user = userRes.rows[0];

        const username =
            normalizedEmail.split('@')[0] +
            '_' +
            Math.floor(1000 + Math.random() * 9000);

        await client.query(
            `INSERT INTO profiles
                (user_id, full_name, username, school, xp, level, streak)
             VALUES ($1, $2, $3, $4, 0, 1, 0)`,
            [user.id, fullName.trim(), username, school?.trim() || null]
        );

        await client.query('COMMIT');

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status
            },
            jwtSecret,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).json({
            success: true,
            message: 'Student account created successfully.',
            user
        });

    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// ADMIN REGISTRATION
router.post(
    '/admin/register',
    validateAdminSecret,
    async (req, res, next) => {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const existing = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [normalizedEmail]
            );

            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    message: 'An account with this email already exists.'
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const userRes = await client.query(
                `INSERT INTO users
                    (email, password_hash, role, status)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [
                    normalizedEmail,
                    hashedPassword,
                    'admin',
                    'pending_approval'
                ]
            );

            const userId = userRes.rows[0].id;

            await client.query(
                `INSERT INTO admin_registration_requests
                    (user_id, status)
                 VALUES ($1, $2)`,
                [userId, 'pending']
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message:
                    'Admin registration request submitted successfully. Account is pending review by an authorized administrator.'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

// AUTH LOGIN
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required.'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = result.rows[0];

        if (user.status === 'pending_approval') {
            return res.status(403).json({
                success: false,
                message:
                    'Your admin account is pending administrator approval.'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message:
                    'Your account has been suspended. Please contact an administrator.'
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!match) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status
            },
            jwtSecret,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        next(err);
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
});

// GET CURRENT USER PROFILE
router.get('/me', authenticateJWT, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.email,
                u.role,
                u.status,
                p.full_name,
                p.username,
                p.school,
                p.exam_type,
                p.xp,
                p.level,
                p.streak
             FROM users u
             LEFT JOIN profiles p ON u.id = p.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found.'
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;