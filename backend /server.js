const express = require('express'); const cors = require('cors'); const cookieParser = require('cookie-parser'); require('dotenv').config();
const { pool } = require('./config');
const authRoutes = require('./routes/auth.routes'); const quizRoutes = require('./routes/quiz.routes');
const app = express(); const PORT = process.env.PORT || 5000;
// CORS Security Configuration
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000'; app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json()); app.use(cookieParser());
// PUBLIC HEALTH CHECK ENDPOINT 
app.get('/api/health', async (req, res) => { try { await pool.query('SELECT 1'); res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() }); } catch (err) { res.status(500).json({ status: 'error', database: 'disconnected', error: err.message }); } });
// MOUNT ROUTERS 
app.use('/api/auth', authRoutes); app.use('/api/quiz', quizRoutes);
// CENTRALIZED ERROR HANDLING MIDDLEWARE 
app.use((err, req, res, next) => { console.error('[SERVER ERROR]:', err.stack); res.status(err.status || 500).json({ success: false, message: err.message || 'An unexpected internal server error occurred.' }); });
// BIND SERVER TO 0.0.0.0 FOR RENDER COMPATIBILITY 
app.listen(PORT, '0.0.0.0', () => { console.log(`[QuizXP Backend] Running on http://0.0.0.0:${PORT}`);