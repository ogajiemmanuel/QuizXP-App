const registerForm = document.getElementById('register-form');
const registerButton = document.getElementById('register-button');
const registerMessage = document.getElementById('register-message');

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const school = document.getElementById('school').value.trim();
    const password = document.getElementById('password').value;

    registerButton.disabled = true;
    registerButton.textContent = 'Creating Account...';
    registerMessage.textContent = '';

    try {
        const data = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: {
                fullName,
                email,
                password,
                school
            }
        });

        registerMessage.textContent = data.message;

        registerForm.reset();

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        registerMessage.textContent = error.message;
    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Create Account';
    }
});
