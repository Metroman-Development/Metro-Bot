const express = require('express');
const cors = require('cors');
const ids = require('../config/ids');

const router = express.Router({ strict: false }); // Allow trailing slashes

// CORS configuration - allow multiple origins
const corsOptions = {
  origin: ['https://api.metroman.me', 'https://cct.metroman.me', 'http://localhost:3000'],
  optionsSuccessStatus: 200,
  credentials: true
};

// Middleware
router.use(cors(corsOptions));
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true }));

// Debug middleware to see incoming requests
router.use((req, res, next) => {
  console.log('=== EXPRESS REQUEST ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Base URL:', req.baseUrl);
  console.log('Headers:', req.headers);
  console.log('=======================');
  next();
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Metro Bot API server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Metro Bot API',
    endpoints: {
      health: '/health',
      bot: '/bot',
      networkInfo: 'POST /bot with type: network-info',
      metroNews: 'POST /bot with type: metro-news',
      announcements: 'POST /bot with type: announcement'
    }
  });
});

// Main bot endpoint - handles all bot-related posts
router.post('/bot', (req, res) => {
  console.log('Received bot request:', req.body);
  
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both "type" and "data" are required in the request body'
    });
  }

  try {
    if (type === 'network-info') {
      const { message, link, photo } = data;
      
      if (!message) {
        return res.status(400).json({ 
          error: 'Missing message field',
          details: 'The "message" field is required for network-info type'
        });
      }

      // Send to Discord
      req.app.get('sendMessage')('DiscordBot', {
        type: 'announcement',
        channelId: ids.discord.networkInfoChannel,
        message,
        link,
        photo,
      });

      // Send to Telegram
      req.app.get('sendMessage')('TelegramBot', {
        type: 'announcement',
        channelId: ids.telegram.channel,
        topicId: ids.telegram.networkInfoTopic,
        message,
        link,
        photo,
      });

      res.status(200).json({ 
        success: true,
        message: 'Network info sent to bots successfully',
        data: { message, link, photo }
      });

    } else if (type === 'metro-news') {
      const { message, link, photo } = data;
      
      if (!message) {
        return res.status(400).json({ 
          error: 'Missing message field',
          details: 'The "message" field is required for metro-news type'
        });
      }

      req.app.get('sendMessage')('DiscordBot', {
        type: 'announcement',
        channelId: ids.discord.metroNewsChannel,
        message,
        link,
        photo,
      });

      req.app.get('sendMessage')('TelegramBot', {
        type: 'announcement',
        channelId: ids.telegram.channel,
        topicId: ids.telegram.metroNewsTopic,
        message,
        link,
        photo,
      });

      res.status(200).json({ 
        success: true,
        message: 'Metro news sent to bots successfully',
        data: { message, link, photo }
      });

    } else if (type === 'announcement') {
      const { message, link, photo } = data;
      
      if (!message) {
        return res.status(400).json({ 
          error: 'Missing message field',
          details: 'The "message" field is required for announcement type'
        });
      }

      req.app.get('sendMessage')('DiscordBot', {
        type: 'announcement',
        channelId: ids.discord.announcements.channel,
        message,
        link,
        photo,
      });

      req.app.get('sendMessage')('TelegramBot', {
        type: 'announcement',
        channelId: ids.telegram.announcements.channel,
        topicId: ids.telegram.announcements.topic,
        message,
        link,
        photo,
      });

      res.status(200).json({ 
        success: true,
        message: 'Announcement sent to bots successfully',
        data: { message, link, photo }
      });

    } else {
      res.status(400).json({ 
        error: 'Invalid type',
        details: 'Type must be one of: network-info, metro-news, announcement',
        receivedType: type
      });
    }
  } catch (error) {
    console.error('Error processing bot request:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: ['GET /health', 'GET /', 'POST /bot']
  });
});

module.exports = router;
