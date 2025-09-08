const express = require('express');
const cors = require('cors');
const ids = require('../config/ids');

const router = express.Router();

// CORS configuration
const corsOptions = {
  origin: ['https://api.metroman.me', 'https://cct.metroman.me', 'http://localhost:3000'],
  optionsSuccessStatus: 200,
};

router.use(cors(corsOptions));
router.use(express.json({ limit: '10mb' }));

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Metro Bot API server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Metro Bot API',
    endpoints: {
      health: '/health',
      bot: '/bot'
    }
  });
});

// Main bot endpoint
router.post('/', (req, res) => {
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
        message: 'Network info sent to bots successfully'
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
        message: 'Metro news sent to bots successfully'
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
        message: 'Announcement sent to bots successfully'
      });

    } else {
      res.status(400).json({ 
        error: 'Invalid type',
        details: 'Type must be one of: network-info, metro-news, announcement'
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

module.exports = router;
