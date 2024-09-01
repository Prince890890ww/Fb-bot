const axios = require('axios');
const rateLimit = new Map();
const description = "stacy,a wonderful bot to chat and play with, created by Lance & Raphael-scholar";

module.exports.config = {
  name: "stacy",
  aliases: ["stacy", "st", "chat"],
  hasPermission: 0,
  version: "1.1",
  credits: "lance x Raphael ilom",
  cooldown: 2,
  usePrefix: false,
  description: "stacy (query)",
  commandCategory: "AI",
  usages: "[question]"
};

module.exports.handleReply = async function ({ api, event }) {
  const { messageID, threadID, senderID, body } = event;
  const link = `https://character-ai-by-lance.onrender.com/api/chat?message=${encodeURIComponent(body)}&chat_id=${senderID}&custom-ai-prompt=${description}`;

  try {
    const response = await axios.get(link);
    await api.sendMessage(response.data.text, threadID, messageID);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    await api.sendMessage("An error occurred while processing your request.", threadID, messageID);
  }
};

module.exports.run = async function ({ api, args, event }) {
  const { threadID, messageID, senderID } = event;
  const inp = args.join(' ');

  // Rate limiting
  if (rateLimit.has(senderID) && (Date.now() - rateLimit.get(senderID)) < 2000) {
    return api.sendMessage("Please wait a moment before sending another request.", threadID, messageID);
  }
  rateLimit.set(senderID, Date.now());

  if (!inp) {
    return api.sendMessage("Please provide a query.", threadID, messageID);
  }

  const command = inp.toLowerCase();

  if (command === 'clear') {
    try {
      const response = await axios.get(`https://character-ai-by-lance.onrender.com/api/history?cmd=yes&chat_id=${senderID}`);
      const message = response.data.message ? 'Successfully deleted chat history.' : 'Chat history not deleted.';
      await api.sendMessage(message, threadID, messageID);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      await api.sendMessage("An error occurred while clearing chat history.", threadID, messageID);
    }
  } else if (command === 'help') {
    const helpMessage = `
      ** Command Help**
      - **chat [question]**: Ask Stacy a question.
      - **chat clear**: Clear chat history.
      - **chat help**: Show this help message.
    `;
    await api.sendMessage(helpMessage, threadID, messageID);
  } else {
    const link = `https://character-ai-by-lance.onrender.com/api/chat?message=${encodeURIComponent(inp)}&chat_id=${senderID}&custom-ai-prompt=${description}`;
    try {
      const response = await axios.get(link);
      await api.sendMessage(response.data.text, threadID, messageID);
      global.client.handleReply.push({
        name: this.config.name,
        author: senderID
      });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      await api.sendMessage("An error occurred while processing your request.", threadID, messageID);
    }
  }
};
