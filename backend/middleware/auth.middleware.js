const jwt = require('jsonwebtoken');
const { jwtSecret, adminSecret } = require('../config');

// Authenticate JWT token from HTTP-only cookie or Authorization header
const authenticateJWT = (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    req.user = decoded;
    
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token.'
    });
  }
};

// Require Admin Role Authorization
const requireAdmin = (req, res, next) => {
  if (
    !req.user ||
    req.user.role !== 'admin' ||
    req.user.status !== 'active'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrative privileges required.'
    });
  }
  
  next();
};

// Validate Secret Registration Key for Administrators
const validateAdminSecret = (req, res, next) => {
  const { secretKey } = req.body;
  
  if (!secretKey || secretKey !== adminSecret) {
    return res.status(403).json({
      success: false,
      message: 'Invalid administrative registration secret key.'
    });
  }
  
  next();
};

module.exports = {
  authenticateJWT,
  requireAdmin,
  validateAdminSecret
};