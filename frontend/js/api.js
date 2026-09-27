// QuizXP Centralized API Fetch Engine

const API_BASE_URL =
  window.API_BASE_URL ||
  (
    window.location.hostname === 'localhost' ?
    'http://localhost:5000' :
    window.location.hostname === '127.0.0.1' ?
    'http://127.0.0.1:5000' :
    ''
  );

async function apiRequest(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include'
  };
  
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    config
  );
  
  let data;
  
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(
      'The server returned an invalid response.'
    );
  }
  
  if (!response.ok) {
    throw new Error(
      data.message ||
      'An error occurred during network communication.'
    );
  }
  
  return data;
}

window.apiRequest = apiRequest;