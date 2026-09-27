const welcomeMessage =
  document.getElementById('welcome-message');

const userEmail =
  document.getElementById('user-email');

const logoutButton =
  document.getElementById('logout-button');

const dashboardMessage =
  document.getElementById('dashboard-message');


async function loadUser() {
  
  try {
    
    const data =
      await apiRequest('/api/auth/me');
    
    const user = data.user;
    
    welcomeMessage.textContent =
      `Welcome, ${user.full_name}!`;
    
    userEmail.textContent =
      user.email;
    
  } catch (error) {
    
    welcomeMessage.textContent =
      'Authentication required';
    
    userEmail.textContent =
      error.message;
    
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  }
}


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