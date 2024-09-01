const axios = require('axios');
const rateLimit = new Map();
const conversationHistory = new Map();

module.exports = {
  config: {
    name: "Stacy",
    version: "1.0",
    author: "Raphael",
    countDown: 5,
    role: 0,
    shortDescription: "AI-powered chatbot",
    longDescription: "An AI-powered chatbot with various features including conversation, image generation, and weather information.",
    category: "ai",
    guide: {
      en: "{p}Stacy [message/command]"
    }
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const input = args.join(" ");

    if (!input) {
      return api.sendMessage("Please provide a message or command.", threadID, messageID);
    }

    await this.run({ api, args, event });
  },

  run: async function ({ api, args, event }) {
    const { threadID, messageID, senderID } = event;
    const input = args.join(' ').trim();

    if (rateLimit.has(senderID) && (Date.now() - rateLimit.get(senderID)) < 2000) {
      return api.sendMessage("Please wait a moment before sending another request.", threadID, messageID);
    }
    rateLimit.set(senderID, Date.now());

    const command = input.toLowerCase().split(' ')[0];

    switch (command) {
      case 'clear':
        try {
          await this.sendRequest('/history', { cmd: 'yes', chat_id: senderID });
          conversationHistory.delete(senderID);
          api.sendMessage('Successfully cleared chat history.', threadID, messageID);
        } catch (error) {
          api.sendMessage(error.message, threadID, messageID);
        }
        break;

      case 'help':
        const helpMessage = `
          **Stacy Command Help**
          - **Stacy [question]**: Ask the chatbot a question.
          - **Stacy clear**: Clear chat history.
          - **Stacy help**: Show this help message.
          - **Stacy history**: Show conversation history.
          - **Stacy image [prompt]**: Generate an image based on the prompt.
          - **Stacy weather [location]**: Get current weather information.
          - **Stacy forecast [location]**: Get extended weather forecast.
        `;
        api.sendMessage(helpMessage, threadID, messageID);
        break;

      case 'history':
        const history = conversationHistory.get(senderID) || [];
        const historyMessage = history.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
        api.sendMessage(historyMessage || 'No conversation history available.', threadID, messageID);
        break;

      case 'image':
        const imagePrompt = args.slice(1).join(' ');
        if (!imagePrompt) {
          return api.sendMessage("Please provide a prompt for image generation.", threadID, messageID);
        }
        try {
          const imageUrl = await this.generateImage(imagePrompt);
          api.sendMessage({ attachment: await global.utils.getStreamFromURL(imageUrl) }, threadID, messageID);
        } catch (error) {
          api.sendMessage(error.message, threadID, messageID);
        }
        break;

      case 'weather':
        const location = args.slice(1).join(' ');
        if (!location) {
          return api.sendMessage("Please provide a location for weather information.", threadID, messageID);
        }
        try {
          const weatherInfo = await this.getWeather(location);
          api.sendMessage(weatherInfo, threadID, messageID);
        } catch (error) {
          api.sendMessage(error.message, threadID, messageID);
        }
        break;

      case 'forecast':
        const forecastLocation = args.slice(1).join(' ');
        if (!forecastLocation) {
          return api.sendMessage("Please provide a location for the weather forecast.", threadID, messageID);
        }
        try {
          const forecastInfo = await this.getWeatherForecast(forecastLocation);
          api.sendMessage(forecastInfo, threadID, messageID);
        } catch (error) {
          api.sendMessage(error.message, threadID, messageID);
        }
        break;

      default:
        try {
          const response = await this.chatWithAI(input, senderID);
          api.sendMessage(response, threadID, messageID);
        } catch (error) {
          api.sendMessage(error.message, threadID, messageID);
        }
        break;
    }
  },

  chatWithAI: async function (input, senderID) {
    const history = conversationHistory.get(senderID) || [];
    history.push({ role: 'user', content: input });

    try {
      const response = await this.sendRequest('/chat', { chat: input, chat_id: senderID });
      history.push({ role: 'assistant', content: response });
      conversationHistory.set(senderID, history);
      return response;
    } catch (error) {
      throw new Error('Failed to get a response from the AI.');
    }
  },

  generateImage: async function (prompt) {
    try {
      const response = await this.sendRequest('/image', { prompt });
      return response.image_url;
    } catch (error) {
      throw new Error('Failed to generate image.');
    }
  },

  getWeather: async function (location) {
    try {
      const response = await this.sendRequest('/weather', { location });
      return `Current weather in ${location}:\n${response}`;
    } catch (error) {
      throw new Error('Failed to get weather information.');
    }
  },

  getWeatherForecast: async function (location) {
    try {
      const response = await this.sendRequest('/forecast', { location });
      return `Weather forecast for ${location}:\n${response}`;
    } catch (error) {
      throw new Error('Failed to get weather forecast.');
    }
  },

  sendRequest: async function (endpoint, data) {
    try {
      const response = await axios.post(`https://api.example.com${endpoint}`, data);
      return response.data;
    } catch (error) {
      throw new Error('Failed to send request to the API.');
    }
  }
};
