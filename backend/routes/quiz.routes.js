const express = require('express');

const { pool } = require('../config');

const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

// GET ALL SUBJECTS
router.get('/subjects', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM subjects WHERE is_active = true ORDER BY name ASC'
        );

        res.json({
            success: true,
            subjects: result.rows
        });
    } catch (err) {
        next(err);
    }
});

// START QUIZ WITH SERVER-SIDE OPTION RANDOMIZATION
router.get('/start/:quizId', authenticateJWT, async (req, res, next) => {
    try {
        const quizRes = await pool.query(
            `SELECT *
             FROM quizzes
             WHERE id = $1
               AND status = 'published'`,
            [req.params.quizId]
        );

        if (quizRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found or is not available.'
            });
        }

        const quiz = quizRes.rows[0];

        let questionQuery = `
            SELECT
                q.id,
                q.question_text,
                q.difficulty,
                q.source
            FROM questions q
            WHERE q.subject_id = $1
              AND q.status = 'approved'
        `;

        const queryParams = [quiz.subject_id];

        if (quiz.topic_id) {
            questionQuery += ' AND q.topic_id = $2';
            queryParams.push(quiz.topic_id);
        }

        questionQuery += `
            ORDER BY RANDOM()
            LIMIT $${queryParams.length + 1}
        `;

        queryParams.push(quiz.question_count);

        const questionsRes = await pool.query(
            questionQuery,
            queryParams
        );

        if (questionsRes.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No approved questions are available for this quiz.'
            });
        }

        const questionsWithShuffledOptions =
            await Promise.all(
                questionsRes.rows.map(async (q) => {
                    const optsRes = await pool.query(
                        `SELECT
                            id,
                            option_key,
                            option_text
                         FROM question_options
                         WHERE question_id = $1
                         ORDER BY order_index ASC`,
                        [q.id]
                    );

                    const shuffled = [...optsRes.rows];

                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(
                            Math.random() * (i + 1)
                        );

                        [shuffled[i], shuffled[j]] =
                            [shuffled[j], shuffled[i]];
                    }

                    return {
                        ...q,
                        options: shuffled
                    };
                })
            );

        res.json({
            success: true,
            quiz,
            questions: questionsWithShuffledOptions
        });

    } catch (err) {
        next(err);
    }
});

// SUBMIT QUIZ & CALCULATE SCORE SERVER-SIDE
router.post('/submit', authenticateJWT, async (req, res, next) => {
    const {
        quizId,
        answers,
        durationSeconds
    } = req.body;

    if (!quizId || !answers || typeof answers !== 'object') {
        return res.status(400).json({
            success: false,
            message: 'Quiz ID and answers are required.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Make sure the quiz exists and is published
        const quizRes = await client.query(
            `SELECT *
             FROM quizzes
             WHERE id = $1
               AND status = 'published'`,
            [quizId]
        );

        if (quizRes.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Quiz not found or is not available.'
            });
        }

        const quiz = quizRes.rows[0];

        let correctCount = 0;

        const questionIds = Object.keys(answers);

        if (questionIds.length === 0) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'No answers were submitted.'
            });
        }

        for (const qId of questionIds) {
            const selectedOptId = answers[qId];

            const checkRes = await client.query(
                `SELECT is_correct
                 FROM question_options
                 WHERE id = $1
                   AND question_id = $2`,
                [selectedOptId, qId]
            );

            if (
                checkRes.rows.length > 0 &&
                checkRes.rows[0].is_correct === true
            ) {
                correctCount++;
            }
        }

        const totalQuestions = questionIds.length;

        const scorePct = Math.round(
            (correctCount / totalQuestions) * 100
        );

        // Basic MVP XP calculation
        const xpGained = correctCount * 5;

        const attemptRes = await client.query(
            `INSERT INTO quiz_attempts
                (
                    user_id,
                    quiz_id,
                    score,
                    correct_answers,
                    total_questions,
                    duration_seconds,
                    xp_gained,
                    status,
                    completed_at
                )
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
             RETURNING id`,
            [
                req.user.id,
                quizId,
                scorePct,
                correctCount,
                totalQuestions,
                durationSeconds || 0,
                xpGained
            ]
        );

        // Ledger XP Record
        await client.query(
            `INSERT INTO xp_transactions
                (
                    user_id,
                    amount,
                    type,
                    description
                )
             VALUES
                ($1, $2, 'quiz_completion', $3)`,
            [
                req.user.id,
                xpGained,
                `Completed quiz with ${scorePct}% score`
            ]
        );

        // Update Profile XP and Level
        await client.query(
            `UPDATE profiles
             SET
                xp = xp + $1,
                level = FLOOR((xp + $1) / 200) + 1,
                updated_at = NOW()
             WHERE user_id = $2`,
            [xpGained, req.user.id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            attemptId: attemptRes.rows[0].id,
            score: scorePct,
            correctCount,
            totalQuestions,
            xpGained
        });

    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

module.exports = router;