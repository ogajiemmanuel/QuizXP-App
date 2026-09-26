const express = require('express');

const {
    calculateQuizXP,
    applyDailyXPCap
} = require('../services/xp.service');

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

// START QUIZ WITH SERVER-SIDE QUESTION SET + OPTION RANDOMIZATION
router.get('/start/:quizId', authenticateJWT, async (req, res, next) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const quizRes = await client.query(
            `SELECT *
             FROM quizzes
             WHERE id = $1
               AND status = 'published'`,
            [req.params.quizId]
        );

        if (quizRes.rows.length === 0) {
            await client.query('ROLLBACK');

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

        const questionsRes = await client.query(
            questionQuery,
            queryParams
        );

        if (
    questionsRes.rows.length !== quiz.question_count
) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'Not enough approved questions are available for this quiz.'
            });
        }

        // Create the exact question set for this quiz attempt.
        const questionIds = questionsRes.rows.map(
            (question) => question.id
        );

        // Create the quiz attempt.
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
                    started_at,
                    question_ids
                )
             VALUES
                (
                    $1,
                    $2,
                    0,
                    0,
                    $3,
                    0,
                    0,
                    'in_progress',
                    NOW(),
                    $4::jsonb
                )
             RETURNING id, started_at`,
            [
                req.user.id,
                quiz.id,
                questionIds.length,
                JSON.stringify(questionIds)
            ]
        );

        const attempt = attemptRes.rows[0];

        const questionsWithShuffledOptions =
            await Promise.all(
                questionsRes.rows.map(async (q) => {
                    const optsRes = await client.query(
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

        await client.query('COMMIT');

        res.json({
            success: true,
            attemptId: attempt.id,
            startedAt: attempt.started_at,
            quiz,
            questions: questionsWithShuffledOptions
        });

    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// SUBMIT QUIZ & CALCULATE SCORE SERVER-SIDE
router.post('/submit', authenticateJWT, async (req, res, next) => {
    const {
    attemptId,
    answers
} = req.body;

    if (
        !attemptId ||
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Attempt ID and answers are required.'
        });
    }



    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get the user's active quiz attempt.
        const attemptRes = await client.query(
            `SELECT
                qa.id,
                qa.quiz_id,
                qa.question_ids,
                qa.status,
                qa.started_at,
                q.question_count,
                q.subject_id,
                q.topic_id,
                q.time_limit_seconds
             FROM quiz_attempts qa
             JOIN quizzes q
               ON q.id = qa.quiz_id
             WHERE qa.id = $1
               AND qa.user_id = $2
               AND qa.status = 'in_progress'
               AND q.status = 'published'`,
            [
                attemptId,
                req.user.id
            ]
        );

        if (attemptRes.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Active quiz attempt not found.'
            });
        }

        const attempt = attemptRes.rows[0];

// Calculate the official quiz duration on the server.
const startedAt = new Date(attempt.started_at).getTime();
const now = Date.now();

const duration = Math.max(
    0,
    Math.floor((now - startedAt) / 1000)
);

        // Make sure the attempt has a stored question set.
        if (
            !Array.isArray(attempt.question_ids) ||
            attempt.question_ids.length === 0
        ) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'This quiz attempt has no valid question set.'
            });
        }

        const questionIds = attempt.question_ids;

        // Every submitted question ID must belong to this attempt.
        const submittedQuestionIds = Object.keys(answers);

        const invalidQuestionIds = submittedQuestionIds.filter(
            (questionId) => !questionIds.includes(questionId)
        );

        if (invalidQuestionIds.length > 0) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'One or more submitted question IDs are invalid for this quiz attempt.'
            });
        }

        // Enforce the quiz time limit using the server-calculated duration.
        if (
            duration > attempt.time_limit_seconds
        ) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'Quiz submission exceeds the allowed time limit.'
            });
        }

        let correctCount = 0;

        // Score every question that was actually assigned
        // to this attempt.
        for (const questionId of questionIds) {
            const selectedOptionId = answers[questionId];

            // Unanswered questions count as wrong.
            if (!selectedOptionId) {
                continue;
            }

            const checkRes = await client.query(
                `SELECT
                    qo.is_correct
                 FROM questions q
                 JOIN question_options qo
                   ON qo.question_id = q.id
                 WHERE q.id = $1
                   AND q.status = 'approved'
                   AND q.subject_id = $2
                   AND ($3::uuid IS NULL OR q.topic_id = $3)
                   AND qo.id = $4`,
                [
                    questionId,
                    attempt.subject_id,
                    attempt.topic_id,
                    selectedOptionId
                ]
            );

            if (checkRes.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    message: 'One or more submitted answers are invalid for this quiz.'
                });
            }

            if (checkRes.rows[0].is_correct === true) {
                correctCount++;
            }
        }

        const totalQuestions = questionIds.length;

const scorePct = Math.round(
    (correctCount / totalQuestions) * 100
);

const xpResult = calculateQuizXP({
    correctAnswers: correctCount,
    totalQuestions,
    durationSeconds: duration
});

const xpCapResult = await applyDailyXPCap(
    client,
    req.user.id,
    xpResult.totalXP
);

const xpGained = xpCapResult.awardedXP;
        // Complete the existing attempt.
        await client.query(
            `UPDATE quiz_attempts
             SET
                score = $1,
                correct_answers = $2,
                total_questions = $3,
                duration_seconds = $4,
                xp_gained = $5,
                status = 'completed',
                completed_at = NOW()
             WHERE id = $6
               AND user_id = $7`,
            [
                scorePct,
                correctCount,
                totalQuestions,
                duration,
                xpGained,
                attemptId,
                req.user.id
            ]
        );

        // XP ledger.
        await client.query(
    `INSERT INTO xp_transactions
        (
            user_id,
            amount,
            type,
            source,
            reference_id,
            description
        )
     VALUES
        ($1, $2, 'quiz_completion', 'quiz', $3, $4)`,
    [
        req.user.id,
        xpGained,
        attemptId,
        `Completed quiz with ${scorePct}% score`
    ]
);

        // Update profile XP and level.
        await client.query(
            `UPDATE profiles
             SET
                xp = xp + $1,
                level = FLOOR((xp + $1) / 200) + 1,
                updated_at = NOW()
             WHERE user_id = $2`,
            [
                xpGained,
                req.user.id
            ]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            attemptId,
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