const express = require('express');
const cors = require('cors');
const ids = require('../config/ids');

const router = express.Router();

const corsOptions = {
  origin: 'https://api.metroman.me',
  optionsSuccessStatus: 200,
};

router.use(cors(corsOptions));
router.use(express.json());

router.post('/bot', (req, res) => {
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).send('Missing type or data');
  }

  if (type === 'network-info') {
    // The logic to send messages will be handled by the main process
    req.app.get('sendMessage')('DiscordBot', {
      channelId: ids.discord.networkInfoChannel,
      message: data.message,
    });
    req.app.get('sendMessage')('TelegramBot', {
      channelId: ids.telegram.channel,
      topicId: ids.telegram.networkInfoTopic,
      message: data.message,
    });
    res.status(200).send('Data received and sent to bots');
  } else if (type === 'metro-news') {
    req.app.get('sendMessage')('DiscordBot', {
      channelId: ids.discord.metroNewsChannel,
      message: data.message,
    });
    req.app.get('sendMessage')('TelegramBot', {
      channelId: ids.telegram.channel,
      topicId: ids.telegram.metroNewsTopic,
      message: data.message,
    });
    res.status(200).send('Data received and sent to bots');
  } else {
    res.status(400).send('Invalid type');
  }
});

module.exports = router;
