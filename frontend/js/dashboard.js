const welcomeMessage =
    document.getElementById('welcome-message');

const userDetails =
    document.getElementById('user-details');

const xpValue =
    document.getElementById('xp-value');

const levelValue =
    document.getElementById('level-value');

const streakValue =
    document.getElementById('streak-value');

const selectedExamText =
    document.getElementById('selected-exam-text');

const examOptions =
    document.querySelectorAll('.exam-option');

const subjectGrid =
    document.querySelector('.subjects-grid');

const startQuizButton =
    document.getElementById('start-quiz-button');

const logoutButton =
    document.getElementById('logout-button');

const dashboardMessage =
    document.getElementById('dashboard-message');


let selectedExam = 'JAMB';
let selectedSubject = null;
let selectedQuizId = null;
let allSubjects = [];


/* Load authenticated student */

async function loadUser() {

    try {

        const data =
            await apiRequest('/api/auth/me');

        const user = data.user;

        welcomeMessage.textContent =
            `Welcome, ${user.full_name}!`;

        userDetails.textContent =
            `${user.exam_type || 'JAMB'} • ${user.school || 'Student'}`;

        xpValue.textContent =
            user.xp ?? 0;

        levelValue.textContent =
            user.level ?? 1;

        streakValue.textContent =
            `${user.streak ?? 0} 🔥`;

        selectedExam =
            user.exam_type || 'JAMB';

        updateExamSelection();

        await loadSubjects();

    } catch (error) {

        welcomeMessage.textContent =
            'Authentication required';

        userDetails.textContent =
            error.message;

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}


/* Load subjects from backend */

async function loadSubjects() {

    try {

        const data =
            await apiRequest('/api/quiz/subjects');

        allSubjects =
            data.subjects || [];

        renderSubjects();

    } catch (error) {

        subjectGrid.innerHTML = '';

        dashboardMessage.textContent =
            error.message;

    }
}


/* Render subjects for selected exam */

function renderSubjects() {

    subjectGrid.innerHTML = '';

    selectedSubject = null;
    selectedQuizId = null;

    const availableSubjects =
        allSubjects.filter((subject) => {

            return (
                subject.exam_type === 'BOTH' ||
                subject.exam_type === selectedExam
            );

        });


    if (availableSubjects.length === 0) {

        subjectGrid.innerHTML = `
            <p>
                No subjects are available for ${selectedExam}.
            </p>
        `;

        return;
    }


    availableSubjects.forEach((subject) => {

        const card =
            document.createElement('button');

        card.type = 'button';

        card.className = 'subject-card';

        card.innerHTML = `
            <span>📚</span>

            <strong>
                ${subject.name}
            </strong>
        `;

        card.addEventListener('click', () => {

            selectSubject(subject, card);

        });

        subjectGrid.appendChild(card);

    });

}


/* Select subject */

async function selectSubject(subject, card) {

    document
        .querySelectorAll('.subject-card')
        .forEach((item) => {

            item.classList.remove('active');

        });

    card.classList.add('active');

    selectedSubject = subject;

    selectedQuizId = null;

    dashboardMessage.textContent =
        `Loading ${subject.name} quizzes...`;

    try {

        const data =
            await apiRequest(
                `/api/quiz/?subjectId=${subject.id}`
            );

        const quizzes =
            data.quizzes || [];


        if (quizzes.length === 0) {

            dashboardMessage.textContent =
                `No ${selectedExam} quiz is available for ${subject.name} yet.`;

            return;
        }


        selectedQuizId =
    quizzes[0].id;

alert(`Selected quiz ID: ${selectedQuizId}`);

dashboardMessage.textContent =
    `${subject.name} selected. Quiz ready to start.`;

    } catch (error) {

        dashboardMessage.textContent =
            error.message;

    }

}


/* Exam selection */

examOptions.forEach((button) => {

    button.addEventListener('click', () => {

        selectedExam =
            button.dataset.exam;

        updateExamSelection();

    });

});


function updateExamSelection() {

    examOptions.forEach((button) => {

        const isSelected =
            button.dataset.exam === selectedExam;

        button.classList.toggle(
            'active',
            isSelected
        );

    });

    selectedExamText.textContent =
        `Choose a subject for ${selectedExam}.`;

    dashboardMessage.textContent = '';

    if (allSubjects.length > 0) {
        renderSubjects();
    }

}


/* Start quiz */

startQuizButton.addEventListener('click', () => {

    if (!selectedSubject) {

        dashboardMessage.textContent =
            'Please choose a subject first.';

        return;
    }


    if (!selectedQuizId) {

        dashboardMessage.textContent =
            `There is no published quiz available for ${selectedSubject.name} yet.`;

        return;
    }


    alert(`Navigating with quiz ID: ${selectedQuizId}`);

window.location.href =
    `quiz.html?quizId=${encodeURIComponent(selectedQuizId)}`;

});


/* Logout */

logoutButton.addEventListener('click', async () => {

    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out...';

    try {

        await apiRequest('/api/auth/logout', {
            method: 'POST'
        });

        window.location.href = 'login.html';

    } catch (error) {

        dashboardMessage.textContent =
            error.message;

        logoutButton.disabled = false;
        logoutButton.textContent = 'Log Out';

    }
});


loadUser();