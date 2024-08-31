const axios = require('axios');
const rateLimit = new Map();
const conversationHistory = new Map();

module.exports.config = {
  name: "stacy",
  aliases: ["stacy", "shino", "chat"],
  hasPermission: 0,
  version: 1.2,
  credits: "Raphael ilom (Enhanced by Assistant)",
  cooldowns: 2,
  usePrefix: true,
  description: "Chat with Stacy AI",
  commandCategory: "AI",
  usages: "[question/command]"
};

const API_URL = 'https://character-ai-by-lance.onrender.com/api';
const RATE_LIMIT_MS = 2000;
const MAX_HISTORY_LENGTH = 10;

async function sendRequest(endpoint, params) {
  try {
    const response = await axios.get(`${API_URL}${endpoint}`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw new Error("An error occurred while processing your request.");
  }
}

function updateConversationHistory(id, message) {
  if (!conversationHistory.has(id)) {
    conversationHistory.set(id, []);
  }
  const history = conversationHistory.get(id);
  history.push(message);
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
}

module.exports.handleReply = async function ({ api, event }) {
  const { messageID, threadID, senderID, body } = event;
  
  try {
    const response = await sendRequest('/chat', { message: body, chat_id: senderID });
    updateConversationHistory(senderID, { role: 'user', content: body });
    updateConversationHistory(senderID, { role: 'assistant', content: response.text });
    api.sendMessage(response.text, threadID, messageID);
  } catch (error) {
    api.sendMessage(error.message, threadID, messageID);
  }
};

module.exports.run = async function ({ api, args, event }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(' ').trim();

  if (rateLimit.has(senderID) && (Date.now() - rateLimit.get(senderID)) < RATE_LIMIT_MS) {
    return api.sendMessage("Please wait a moment before sending another request.", threadID, messageID);
  }
  rateLimit.set(senderID, Date.now());

  if (!input) {
    return api.sendMessage("Please provide a query or command.", threadID, messageID);
  }

  const command = input.toLowerCase();

  switch (command) {
    case 'clear':
      try {
        await sendRequest('/history', { cmd: 'yes', chat_id: senderID });
        conversationHistory.delete(senderID);
        api.sendMessage('Successfully cleared chat history.', threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;

    case 'help':
      const helpMessage = `
        **Stacy Command Help**
        - **stacy [question]**: Ask Stacy a question.
        - **stacy clear**: Clear chat history.
        - **stacy help**: Show this help message.
        - **stacy history**: Show conversation history.
      `;
      api.sendMessage(helpMessage, threadID, messageID);
      break;

    case 'history':
      const history = conversationHistory.get(senderID) || [];
      const historyMessage = history.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
      api.sendMessage(historyMessage || 'No conversation history available.', threadID, messageID);
      break;

    default:
      try {
        const response = await sendRequest('/chat', { message: input, chat_id: senderID });
        updateConversationHistory(senderID, { role: 'user', content: input });
        updateConversationHistory(senderID, { role: 'assistant', content: response.text });
        api.sendMessage(response.text, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;
  }
};

// Add new function to handle image generation
async function generateImage(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      prompt: prompt,
      n: 1,
      size: "512x512"
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data[0].url;
  } catch (error) {
    console.error(`Error generating image: ${error.message}`);
    throw new Error("An error occurred while generating the image.");
  }
}

// Modify the run function to include image generation
module.exports.run = async function ({ api, args, event }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(' ').trim();

  if (rateLimit.has(senderID) && (Date.now() - rateLimit.get(senderID)) < RATE_LIMIT_MS) {
    return api.sendMessage("Please wait a moment before sending another request.", threadID, messageID);
  }
  rateLimit.set(senderID, Date.now());

  if (!input) {
    return api.sendMessage("Please provide a query or command.", threadID, messageID);
  }

  const command = input.toLowerCase();

  switch (command) {
    // ... (previous cases remain the same)

    case 'image':
      const imagePrompt = args.slice(1).join(' ');
      if (!imagePrompt) {
        return api.sendMessage("Please provide a prompt for image generation.", threadID, messageID);
      }
      try {
        const imageUrl = await generateImage(imagePrompt);
        api.sendMessage({ attachment: await global.utils.getStreamFromURL(imageUrl) }, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;

    default:
      // ... (previous default case remains the same)
  }
};

// Add function to get weather information
async function getWeather(location) {
  try {
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    const { main, weather } = response.data;
    return `Weather in ${location}:\nTemperature: ${main.temp}°C\nDescription: ${weather[0].description}\nHumidity: ${main.humidity}%`;
  } catch (error) {
    console.error(`Error getting weather: ${error.message}`);
    throw new Error("An error occurred while fetching weather information.");
  }
}

// Modify the run function to include weather information
module.exports.run = async function ({ api, args, event }) {
  // ... (previous code remains the same)

  switch (command) {
    // ... (previous cases remain the same)

case 'weather':
      const location = args.slice(1).join(' ');
      if (!location) {
        return api.sendMessage("Please provide a location for weather information.", threadID, messageID);
      }
      try {
        const weatherInfo = await getWeather(location);
        api.sendMessage(weatherInfo, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;

    case 'help':
      const helpMessage = `Available commands:
      - clear: Clear conversation history
      - history: Show conversation history
      - image [prompt]: Generate an image based on the prompt
      - weather [location]: Get weather information for a location
      - help: Show this help message`;
      api.sendMessage(helpMessage, threadID, messageID);
      break;

    default:
      try {
        const response = await sendRequest('/chat', { message: input, chat_id: senderID });
        updateConversationHistory(senderID, { role: 'user', content: input });
        updateConversationHistory(senderID, { role: 'assistant', content: response.text });
        api.sendMessage(response.text, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;
  }
};

// Helper function to format the date
function formatDate(date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Add function to get extended weather forecast
async function getExtendedWeather(location) {
  try {
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    const { list } = response.data;
    let forecast = `Extended Weather Forecast for ${location}:\n\n`;
    
    for (let i = 0; i < list.length; i += 8) {
      const { dt, main, weather } = list[i];
      const date = new Date(dt * 1000);
      forecast += `${formatDate(date)}:\n`;
      forecast += `Temperature: ${main.temp}°C\n`;
      forecast += `Description: ${weather[0].description}\n`;
      forecast += `Humidity: ${main.humidity}%\n\n`;
    }
    
    return forecast;
  } catch (error) {
    console.error(`Error getting extended weather: ${error.message}`);
    throw new Error("An error occurred while fetching extended weather information.");
  }
}

// Modify the run function to include extended weather forecast
module.exports.run = async function ({ api, args, event }) {
  // ... (previous code remains the same)

  switch (command) {
    // ... (previous cases remain the same)

    case 'weather':
      const location = args.slice(1).join(' ');
      if (!location) {
        return api.sendMessage("Please provide a location for weather information.", threadID, messageID);
      }
      try {
        const weatherInfo = await getWeather(location);
        api.sendMessage(weatherInfo, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;

    case 'forecast':
      const forecastLocation = args.slice(1).join(' ');
      if (!forecastLocation) {
        return api.sendMessage("Please provide a location for the extended weather forecast.", threadID, messageID);
      }
      try {
        const extendedWeather = await getExtendedWeather(forecastLocation);
        api.sendMessage(extendedWeather, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;

    case 'help':
      const helpMessage = `Available commands:
      - clear: Clear conversation history
      - history: Show conversation history
      - image [prompt]: Generate an image based on the prompt
      - weather [location]: Get current weather information for a location
      - forecast [location]: Get extended weather forecast for a location
      - help: Show this help message`;
      api.sendMessage(helpMessage, threadID, messageID);
      break;

    default:
      try {
        const response = await sendRequest('/chat', { message: input, chat_id: senderID });
        updateConversationHistory(senderID, { role: 'user', content: input });
        updateConversationHistory(senderID, { role: 'assistant', content: response.text });
        api.sendMessage(response.text, threadID, messageID);
      } catch (error) {
        api.sendMessage(error.message, threadID, messageID);
      }
      break;
  }
};

// Helper function to format the date
function formatDate(date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Function to get extended weather forecast
async function getExtendedWeather(location) {
  try {
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    const { list } = response.data;
    let forecast = `Extended Weather Forecast for ${location}:\n\n`;
    
    for (let i = 0; i < list.length; i += 8) {
      const { dt, main, weather } = list[i];
      const date = new Date(dt * 1000);
      forecast += `${formatDate(date)}:\n`;
      forecast += `Temperature: ${main.temp}°C\n`;
      forecast += `Description: ${weather[0].description}\n`;
      forecast += `Humidity: ${main.humidity}%\n\n`;
    }
    
    return forecast;
  } catch (error) {
    console.error(`Error getting extended weather: ${error.message}`);
    throw new Error("An error occurred while fetching extended weather information.");
  }
}

module.exports = {
  config: {
    name: "chatbot",
    version: "1.0",
    author: "Raphael",
    countDown: 5,
    role: 0,
    shortDescription: "AI-powered chatbot",
    longDescription: "An AI-powered chatbot with various features including conversation, image generation, and weather information.",
    category: "ai",
    guide: {
      en: "{p}chatbot [message]"
    }
  },
  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const input = args.join(" ");

    if (!input) {
      return api.sendMessage("Please provide a message or command.", threadID, messageID);
    }

    await module.exports.run({ api, args, event });
  },
  run
};
