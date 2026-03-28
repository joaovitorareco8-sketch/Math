require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Routes
const sessionRoutes      = require('./src/routes/session');
const studentRoutes      = require('./src/routes/student');
const diagnosticRoutes   = require('./src/routes/diagnostic');

app.use('/session',    sessionRoutes);
app.use('/student',    studentRoutes);
app.use('/diagnostic', diagnosticRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
