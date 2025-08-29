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

router.post('/bot/', (req, res) => {
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).send('Missing type or data');
  }

  if (type === 'network-info') {
    const { message, link, photo } = data;
    // The logic to send messages will be handled by the main process
    req.app.get('sendMessage')('DiscordBot', {
      type: 'announcement',
      channelId: ids.discord.networkInfoChannel,
      message,
      link,
      photo,
    });
    req.app.get('sendMessage')('TelegramBot', {
      type: 'announcement',
      channelId: ids.telegram.channel,
      topicId: ids.telegram.networkInfoTopic,
      message,
      link,
      photo,
    });
    res.status(200).send('Data received and sent to bots');
  } else if (type === 'metro-news') {
    const { message, link, photo } = data;
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
    res.status(200).send('Data received and sent to bots');
  } else if (type === 'announcement') {
    const { message, link, photo } = data;
    if (!message) {
      return res.status(400).send('Missing message in data for announcement');
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
    res.status(200).send('Announcement sent to bots');
  } else {
    res.status(400).send('Invalid type');
  }
});

module.exports = router;
