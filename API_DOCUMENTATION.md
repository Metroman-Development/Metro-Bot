# API Documentation

This document provides details on how to use the API to send announcements to the Discord and Telegram bots.

## Announcement Endpoint

The API for sending announcements is integrated into the existing bot communication endpoint.

- **URL:** `/bot`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`

### Request Body

The request body must be a JSON object with two main properties: `type` and `data`.

- `type` (string, required): Specifies the type of message to send. See "Message Types" below for more details.
- `data` (object, required): This object contains the content of the message.

### Message Types

The API supports the following message types:

- `announcement`: For general announcements.
- `network-info`: For information about the network status.
- `metro-news`: For news related to the metro system.

All message types share the same `data` object structure.

#### `data` Object Properties

- `message` (string, required): The main text of the message.
- `link` (string, optional): A URL to include with the message. In Discord, this will be part of the embed. In Telegram, it will be an inline button.
- `photo` (string, optional): A URL to an image to include with the message. In Discord, this will be the main image of the embed. In Telegram, it will be sent as a photo with the message as the caption.

### Example Request Payloads

#### Simple Text-Only Announcement

```json
{
  "type": "announcement",
  "data": {
    "message": "Hello, this is an important announcement!"
  }
}
```

#### Announcement with a Link

```json
{
  "type": "announcement",
  "data": {
    "message": "Check out our new website!",
    "link": "https://www.example.com"
  }
}
```

#### Announcement with a Photo and a Link

```json
{
  "type": "announcement",
  "data": {
    "message": "Here is a picture of our new office.",
    "link": "https://www.example.com/about-us",
    "photo": "https://www.example.com/office.jpg"
  }
}
```

## Configuration

Before using the announcement feature, you must configure the destination channel and topic IDs in `src/config/ids.js`.

Find the `announcements` object within both the `discord` and `telegram` sections and replace the placeholder values with your actual IDs.

```javascript
// src/config/ids.js

module.exports = {
  discord: {
    // ... other ids
    announcements: {
      channel: 'YOUR_DISCORD_CHANNEL_ID', // <--- SET THIS
    },
  },
  telegram: {
    // ... other ids
    announcements: {
      channel: 'YOUR_TELEGRAM_CHANNEL_ID', // <--- SET THIS
      topic: 'YOUR_TELEGRAM_TOPIC_ID',   // <--- SET THIS
    },
  },
};
```
