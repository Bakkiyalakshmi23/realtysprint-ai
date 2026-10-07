const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/health');
const agentRoutes = require('./routes/agents');
const taskRoutes = require('./routes/tasks');
const leadRoutes = require('./routes/leads');
const approvalRoutes = require('./routes/approvals');
const activityRoutes = require('./routes/activity');

const app = express();

// Global Middleware
app.use(cors({
  origin: [config.corsOrigin, 'http://localhost:8000', 'http://127.0.0.1:8000'],
  credentials: true
}));
app.use(express.json());

// API Routes Registration
app.use('/api/health', healthRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/activity', activityRoutes);

// 404 Route Handler for undefined endpoints
app.use((req, res, next) => {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Server startup
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🚀 RealtySprint AI Backend API Online`);
  console.log(`📍 Environment: ${config.env}`);
  console.log(`🌐 Listening on: http://localhost:${PORT}`);
  console.log(`==========================================`);
});

module.exports = app;
