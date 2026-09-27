
const quizTitle =
    document.getElementById('quiz-title');

const quizDescription =
    document.getElementById('quiz-description');

const quizType =
    document.getElementById('quiz-type');

const timer =
    document.getElementById('timer');

const questionProgress =
    document.getElementById('question-progress');

const questionScore =
    document.getElementById('question-score');

const progressFill =
    document.getElementById('progress-fill');

const questionContainer =
    document.getElementById('question-container');

const previousButton =
    document.getElementById('previous-button');

const nextButton =
    document.getElementById('next-button');

const submitContainer =
    document.getElementById('submit-container');

const submitButton =
    document.getElementById('submit-button');

const questionNumberNavigation =
    document.getElementById('question-number-navigation');


const quizMessage =
    document.getElementById('quiz-message');


let quiz = null;
let questions = [];
let attemptId = null;

let currentQuestionIndex = 0;

let answers = {};

let timerInterval = null;
let remainingSeconds = 0;


/* Get quiz ID from URL */

const urlParams =
    new URLSearchParams(window.location.search);

const quizId =
    urlParams.get('quizId');



/* Load quiz */

async function loadQuiz() {

    if (!quizId) {

        showError(
            'No quiz was selected.'
        );

        return;
    }


    try {


const data =
    await apiRequest(
        `/api/quiz/start/${quizId}`
    );


        quiz =
            data.quiz;

        questions =
            data.questions || [];

        attemptId =
            data.attemptId;


        if (questions.length === 0) {

            showError(
                'This quiz has no questions available.'
            );

            return;
        }


        quizTitle.textContent =
            quiz.title;

        quizDescription.textContent =
            quiz.description || '';

        quizType.textContent =
            quiz.quiz_type || 'Quiz';


        /*
         * The backend records the actual start time.
         * Calculate the remaining time from that timestamp.
         */

        const startedAt =
            new Date(data.startedAt).getTime();

        const now =
            Date.now();

        const elapsedSeconds =
            Math.floor(
                (now - startedAt) / 1000
            );

        remainingSeconds =
            Math.max(
                0,
                quiz.time_limit_seconds -
                elapsedSeconds
            );


        renderQuestion();

        startTimer();

    } catch (error) {
    
    console.error('Quiz load error:', error);
    
    showError(
        `Quiz load error: ${error.message}`
    );
    
}

}


/* Render current question */

function renderQuestion() {

    const question =
        questions[currentQuestionIndex];


    if (!question) {
        return;
    }


    const totalQuestions =
        questions.length;

    const questionNumber =
        currentQuestionIndex + 1;


    questionProgress.textContent =
        `Question ${questionNumber} of ${totalQuestions}`;


    questionScore.textContent =
        `${Object.keys(answers).length} answered`;


    progressFill.style.width =
        `${(questionNumber / totalQuestions) * 100}%`;


    questionContainer.innerHTML = '';


    const questionCard =
        document.createElement('div');

    questionCard.className =
        'question-card';


    const questionNumberElement =
        document.createElement('span');

    questionNumberElement.className =
        'question-number';

    questionNumberElement.textContent =
        `Question ${questionNumber}`;


    const questionText =
        document.createElement('h2');

    questionText.className =
        'question-text';

    questionText.textContent =
        question.question_text;


    const optionsContainer =
        document.createElement('div');

    optionsContainer.className =
        'answer-options';


    question.options.forEach((option) => {

        const optionButton =
            document.createElement('button');

        optionButton.type =
            'button';

        optionButton.className =
            'answer-option';


        if (
            answers[question.id] ===
            option.id
        ) {

            optionButton.classList.add(
                'selected'
            );

        }


        optionButton.innerHTML = `
            <span class="option-key">
                ${option.option_key}
            </span>

            <span class="option-text">
                ${option.option_text}
            </span>
        `;


        optionButton.addEventListener(
            'click',
            () => {

                answers[question.id] =
                    option.id;

                renderQuestion();

            }
        );


        optionsContainer.appendChild(
            optionButton
        );

    });


    questionCard.appendChild(
        questionNumberElement
    );

    questionCard.appendChild(
        questionText
    );

    questionCard.appendChild(
        optionsContainer
    );


    questionContainer.appendChild(
        questionCard
    );



    renderQuestionNumbers();

    updateNavigation();

}



/* Question number navigation */

function renderQuestionNumbers() {

    questionNumberNavigation.innerHTML = "";

    questions.forEach((question, index) => {

        const numberButton =
            document.createElement("button");

        numberButton.type = "button";
        numberButton.className = "question-number-button";
        numberButton.textContent = index + 1;

        if (index === currentQuestionIndex) {
            numberButton.classList.add("active");
        }

        if (answers[question.id]) {
            numberButton.classList.add("answered");
        }

        numberButton.addEventListener("click", () => {
            currentQuestionIndex = index;
            renderQuestion();
        });

        questionNumberNavigation.appendChild(
            numberButton
        );

    });

}

/* Navigation */

function updateNavigation() {

    previousButton.disabled =
        currentQuestionIndex === 0;


    const isLastQuestion =
        currentQuestionIndex ===
        questions.length - 1;


    nextButton.hidden =
        isLastQuestion;

    submitContainer.hidden =
        !isLastQuestion;

}


/* Previous question */

previousButton.addEventListener(
    'click',
    () => {

        if (
            currentQuestionIndex > 0
        ) {

            currentQuestionIndex--;

            renderQuestion();

        }

    }
);


/* Next question */

nextButton.addEventListener(
    'click',
    () => {

        if (
            currentQuestionIndex <
            questions.length - 1
        ) {

            currentQuestionIndex++;

            renderQuestion();

        }

    }
);


/* Timer */

function startTimer() {

    updateTimerDisplay();


    timerInterval =
        setInterval(() => {

            remainingSeconds--;

            updateTimerDisplay();


            if (
                remainingSeconds <= 0
            ) {

                clearInterval(
                    timerInterval
                );

                timer.textContent =
                    '00:00';

                submitQuiz();

            }

        }, 1000);

}


function updateTimerDisplay() {

    const minutes =
        Math.floor(
            remainingSeconds / 60
        );

    const seconds =
        remainingSeconds % 60;


    timer.textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

}


/* Submit */

submitButton.addEventListener(
    'click',
    () => {

        submitQuiz();

    }
);


async function submitQuiz() {

    if (!attemptId) {
        return;
    }


    clearInterval(
        timerInterval
    );


    submitButton.disabled =
        true;

    submitButton.textContent =
        'Submitting...';


    nextButton.disabled =
        true;

    previousButton.disabled =
        true;


    try {

        const data =
            await apiRequest(
                '/api/quiz/submit',
                {
                    method: 'POST',

                    body: {
                        attemptId,
                        answers
                    }
                }
            );


        showResult(data);


    } catch (error) {

        quizMessage.textContent =
            error.message;

        submitButton.disabled =
            false;

        submitButton.textContent =
            'Submit Quiz';

    }

}


/* Show result */

function showResult(data) {

    questionContainer.innerHTML = `
        <div class="quiz-result">

            <span class="badge">
                Quiz Complete
            </span>

            <h2>
                Your Score
            </h2>

            <strong class="result-score">
                ${data.score}%
            </strong>

            <p>
                You answered
                ${data.correctCount}
                out of
                ${data.totalQuestions}
                questions correctly.
            </p>

            <p>
                XP gained:
                <strong>
                    ${data.xpGained}
                </strong>
            </p>

            <button
                type="button"
                class="btn-primary btn-lg"
                id="dashboard-button"
            >
                Back to Dashboard
            </button>

        </div>
    `;


    questionProgress.textContent =
        'Quiz complete';

    questionScore.textContent =
        `${data.correctCount}/${data.totalQuestions} correct`;

    progressFill.style.width =
        '100%';


    previousButton.hidden =
        true;

    nextButton.hidden =
        true;

    submitContainer.hidden =
        true;


    document
        .getElementById('dashboard-button')
        .addEventListener(
            'click',
            () => {

                window.location.href =
                    'dashboard.html';

            }
        );

}


/* Error */

function showError(message) {

    questionContainer.innerHTML = `
        <div class="form-message">
            ${message}
        </div>
    `;

    quizMessage.textContent =
        'Unable to load the quiz.';

}


/* Start */


loadQuiz();