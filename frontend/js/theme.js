const themeToggle = document.getElementById('theme-toggle');

const savedTheme = localStorage.getItem('quizxp-theme');

if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function updateThemeButton() {
    const currentTheme =
        document.documentElement.getAttribute('data-theme');

    if (themeToggle) {
        themeToggle.textContent =
            currentTheme === 'light' ? '☀️' : '🌙';
    }
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme =
            document.documentElement.getAttribute('data-theme');

        const newTheme =
            currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute(
            'data-theme',
            newTheme
        );

        localStorage.setItem(
            'quizxp-theme',
            newTheme
        );

        updateThemeButton();
    });
}

updateThemeButton();
