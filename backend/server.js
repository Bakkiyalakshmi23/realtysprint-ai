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
const agentExecuteRoutes = require('./routes/agentExecute');
const businessRoutes = require('./routes/business');
const aiRoutes = require('./routes/ai');
const clientRoutes = require('./routes/clients');
const authRoutes = require('./routes/auth');

const app = express();

// Global Middleware
const allowedOrigins = config.corsOrigin ? config.corsOrigin.split(',').map(o => o.trim()) : [];
if (config.env !== 'production') {
  allowedOrigins.push('http://localhost:8000', 'http://127.0.0.1:8000');
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation: origin not allowed'));
    }
  },
  credentials: true
}));
const webhookRoutes = require('./routes/webhooks');

// Webhook routes must be mounted BEFORE express.json() to allow express.raw() parsing
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

// API Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/agents', agentExecuteRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/clients', clientRoutes);

// 404 Route Handler for undefined endpoints
app.use((req, res, next) => {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Server startup
if (require.main === module) {
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`🚀 RealtySprint AI Backend API Online`);
    console.log(`📍 Environment: ${config.env}`);
    console.log(`🌐 Listening on: http://localhost:${PORT}`);
    console.log(`==========================================`);
  });

  const gracefulShutdown = () => {
    console.log('\n[server] Shutdown signal received. Closing HTTP server...');
    server.close(() => {
      console.log('[server] HTTP server closed.');
      const { pool } = require('./db/pool');
      pool.end(() => {
        console.log('[server] Database pool closed.');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

module.exports = app;
