require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_HISTORY = 10;
const AUTHORIZED_AUTHOR = 'Raphael';
const USER_DATA_FILE = path.join(__dirname, 'userData.json');

let userData = {};
let conversationHistory = new Map();
let cache = new Map();

async function loadUserData() {
  try {
    const data = await fs.readFile(USER_DATA_FILE, 'utf8');
    userData = JSON.parse(data);
  } catch (error) {
    console.error("Error loading user data:", error.message);
  }
}

async function saveUserData() {
  await fs.writeFile(USER_DATA_FILE, JSON.stringify(userData, null, 2));
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
    console.error("Error:", error.response ? error.response.data : error.message);
    return "Sorry, an error occurred while processing your request.";
  }
}

function getUserProfile(userId) {
  if (!userData[userId]) {
    userData[userId] = {
      preferences: {},
      history: [],
      lastActive: new Date()
    };
  }
  return userData[userId];
}

function getGreetingMessage(userId) {
  const hours = new Date().getHours();
  let greeting = hours < 12 ? "Good morning!" : hours < 18 ? "Good afternoon!" : "Good evening!";
  const profile = getUserProfile(userId);
  return profile.preferences.name ? `${greeting} 😊 I'm glad to see you again, ${profile.preferences.name}!` : greeting;
}

async function getJoke() {
  try {
    const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke');
    return `${data.setup} ${data.punchline}`;
  } catch (error) {
    console.error("Error fetching joke:", error.message);
    return "Why did the AI cross the road? To get to the other dataset!";
  }
}

async function getWeather(city) {
  if (cache.has(city)) {
    return cache.get(city);
  }
  try {
    const { data } = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${a9b4c37c68380d91903251d40ffa89ec}&units=metric`);
    const weatherInfo = `The weather in ${city} is ${data.weather[0].description} with a temperature of ${data.main.temp}°C.`;
    cache.set(city, weatherInfo);
    return weatherInfo;
  } catch (error) {
    console.error("Error fetching weather:", error.message);
    return "Sorry, I couldn't fetch the weather information at the moment.";
  }
}

function setUserPreference(userId, key, value) {
  const profile = getUserProfile(userId);
  profile.preferences[key] = value;
  saveUserData();
}

function clearUserHistory(userId) {
  const profile = getUserProfile(userId);
  profile.history = [];
  saveUserData();
}

async function getAIResponse(input, userId) {
  const profile = getUserProfile(userId);
  let response = await geminiAPI(input, userId);

  if (profile.preferences.likesJokes) {
    const joke = await getJoke();
    response += `\n\nHere's a joke for you: ${joke}`;
  }

  return response;
}

async function onReply({ api, event, args }) {
  const input = args.join(' ').trim();
  if (!input) {
    const greeting = getGreetingMessage(event.senderID);
    api.sendMessage(greeting, event.threadID, event.messageID);
    return;
  }

  let response;
  if (input.toLowerCase().startsWith('weather')) {
    const city = input.split(' ').slice(1).join(' ');
    response = await getWeather(city);
  } else {
    response = await getAIResponse(input, event.senderID);
  }

  api.sendMessage(response, event.threadID, event.messageID);
}

const prefixes = ['lea', 'stacy'];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later."
});

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
    if (!input) {
      const greeting = getGreetingMessage(event.senderID);
      api.sendMessage(greeting, event.threadID, event.messageID);
      return;
    }

    const response = await getAIResponse(input, event.senderID);
    api.sendMessage(response, event.threadID, event.messageID);
  },
  onReply: onReply,
  limiter: limiter
};
