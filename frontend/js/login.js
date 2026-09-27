const loginForm =
  document.getElementById('login-form');

const loginButton =
  document.getElementById('login-button');

const loginMessage =
  document.getElementById('login-message');


loginForm.addEventListener('submit', async (event) => {
  
  event.preventDefault();
  
  const email =
    document.getElementById('email').value.trim();
  
  const password =
    document.getElementById('password').value;
  
  loginButton.disabled = true;
  loginButton.textContent = 'Signing In...';
  loginMessage.textContent = '';
  
  try {
    
    const data = await apiRequest(
      '/api/auth/login',
      {
        method: 'POST',
        body: {
          email,
          password
        }
      }
    );
    
    loginMessage.textContent =
      data.message;
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 500);
    
  } catch (error) {
    
    loginMessage.textContent =
      error.message;
    
  } finally {
    
    loginButton.disabled = false;
    loginButton.textContent = 'Sign In';
    
  }
});