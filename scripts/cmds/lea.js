const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = 'AIzaSyDexXPq3VSDwWSfzfnONTEKStfs42sTRIY';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_HISTORY = 10;
const AUTHORIZED_AUTHOR = 'Raphael Scholar';
const USER_DATA_FILE = path.join(__dirname, 'userData.json');

let userData = {};
if (fs.existsSync(USER_DATA_FILE)) {
  userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
}

async function geminiAPI(prompt, userId, retries = 0) {
  try {
    const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      params: { key: GEMINI_API_KEY },
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return geminiAPI(prompt, userId, retries + 1);
    }
    return "Sorry, an error occurred while processing your request.";
  }
}

async function getAIResponse(input, userId) {
  return await geminiAPI(input, userId);
}

function saveUserData() {
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2));
}

function getUserProfile(userId) {
  if (!userData[userId]) {
    userData[userId] = { preferences: {}, history: [] };
  }
  return userData[userId];
}

function addUserMessageToHistory(userId, message) {
  const profile = getUserProfile(userId);
  profile.history.push(message);
  if (profile.history.length > MAX_HISTORY) {
    profile.history.shift();
  }
  saveUserData();
}

function getGreetingMessage(userId) {
  const hours = new Date().getHours();
  let greeting = hours < 12 ? "Good morning!" : hours < 18 ? "Good afternoon!" : "Good evening!";
  const profile = getUserProfile(userId);
  greeting += profile.preferences.name ? ` 😊 I'm Lea, your AI assistant created by Raphael Scholar. How can I help you today, ${profile.preferences.name}?` : " 😊 I'm Lea, your AI assistant created by Raphael Scholar. How can I help you today?";
  return greeting;
}

const prefixes = ['lea', 'stacy'];
const conversationHistory = new Map();

module.exports = {
  config: {
    name: 'lea',
    author: AUTHORIZED_AUTHOR,
    role: 0,
    category: 'ai',
    shortDescription: 'AI-powered interactive assistant',
    longDescription: 'An AI-powered assistant that can answer questions and engage in conversations.',
    usage: '{prefix}lea <your question or message>',
  },
  onStart: async function ({ api, event, args }) {
    if (this.config.author !== AUTHORIZED_AUTHOR) {
      api.sendMessage("Unauthorized author. Access denied.", event.threadID, event.messageID);
      return;
    }

    const input = args.join(' ').trim();
    if (!input) {
      const greeting = getGreetingMessage(event.senderID);
      api.sendMessage(greeting, event.threadID, event.messageID);
      return;
    }

    const response = await getAIResponse(input, event.senderID);
    api.sendMessage(response, event.threadID, event.messageID);
  },
  onChat: async function ({ api, event, message, args }) {
    if (this.config.author !== AUTHORIZED_AUTHOR) {
      api.sendMessage("Unauthorized author. Access denied.", event.threadID, event.messageID);
      return;
    }

    const input = args.join(' ').trim();
    if (input) {
      const response = await getAIResponse(input, event.senderID);
      api.sendMessage(response, event.threadID, event.messageID);
    }
  }
};
