const XP_RULES = {
    XP_PER_CORRECT_ANSWER: 5,
    PERFECT_QUIZ_BONUS: 20,

    SPEED_BONUS: {
        UNDER_1_MINUTE: 20,
        UNDER_3_MINUTES: 15,
        UNDER_5_MINUTES: 10
    },

    DAILY_XP_CAP: 300
};

function calculateQuizXP({
    correctAnswers,
    totalQuestions,
    durationSeconds
}) {
    let xp = 0;
    const breakdown = [];

    // XP for correct answers
    const answerXP =
        correctAnswers * XP_RULES.XP_PER_CORRECT_ANSWER;

    xp += answerXP;

    if (answerXP > 0) {
        breakdown.push({
            type: 'correct_answers',
            amount: answerXP,
            description:
                `${correctAnswers} correct answer(s)`
        });
    }

    // Perfect quiz bonus
    if (
        totalQuestions > 0 &&
        correctAnswers === totalQuestions
    ) {
        xp += XP_RULES.PERFECT_QUIZ_BONUS;

        breakdown.push({
            type: 'perfect_quiz',
            amount: XP_RULES.PERFECT_QUIZ_BONUS,
            description: 'Perfect quiz bonus'
        });
    }

    // Speed bonus
    if (durationSeconds < 60) {
        xp += XP_RULES.SPEED_BONUS.UNDER_1_MINUTE;

        breakdown.push({
            type: 'speed_bonus',
            amount: XP_RULES.SPEED_BONUS.UNDER_1_MINUTE,
            description: 'Completed in under 1 minute'
        });
    } else if (durationSeconds < 180) {
        xp += XP_RULES.SPEED_BONUS.UNDER_3_MINUTES;

        breakdown.push({
            type: 'speed_bonus',
            amount: XP_RULES.SPEED_BONUS.UNDER_3_MINUTES,
            description: 'Completed in under 3 minutes'
        });
    } else if (durationSeconds < 300) {
        xp += XP_RULES.SPEED_BONUS.UNDER_5_MINUTES;

        breakdown.push({
            type: 'speed_bonus',
            amount: XP_RULES.SPEED_BONUS.UNDER_5_MINUTES,
            description: 'Completed in under 5 minutes'
        });
    }

    return {
        totalXP: xp,
        breakdown
    };
}

/**
 * Determine how much XP the user can actually receive today.
 *
 * The XP engine calculates the activity's XP first.
 * This function applies the global daily cap.
 */
async function applyDailyXPCap(client, userId, requestedXP) {
    if (requestedXP <= 0) {
        return {
            requestedXP,
            awardedXP: 0,
            capped: false,
            dailyXPBefore: 0,
            dailyXPAfter: 0
        };
    }

    const result = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS daily_xp
         FROM xp_transactions
         WHERE user_id = $1
           AND created_at >= CURRENT_DATE
           AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
        [userId]
    );

    const dailyXPBefore = Number(result.rows[0].daily_xp);

    const remainingXP = Math.max(
        0,
        XP_RULES.DAILY_XP_CAP - dailyXPBefore
    );

    const awardedXP = Math.min(
        requestedXP,
        remainingXP
    );

    return {
        requestedXP,
        awardedXP,
        capped: awardedXP < requestedXP,
        dailyXPBefore,
        dailyXPAfter: dailyXPBefore + awardedXP
    };
}

module.exports = {
    XP_RULES,
    calculateQuizXP,
    applyDailyXPCap
};
