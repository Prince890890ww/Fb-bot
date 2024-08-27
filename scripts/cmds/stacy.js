const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const AUTHOR_NAME = 'Raphael Ilom';

const client = new Anthropic({
    apiKey: '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'
});

module.exports.config = {
    name: "stacy",
    haspermssion: 0,
    version: 1.0,
    credits: AUTHOR_NAME,
    cooldowns: 2,
    usePrefix: false,
    description: "Stacy (query)",
    commandCategory: "AI",
    usages: "[question]"
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    const { messageID, threadID } = event;
    const userMessage = event.body;

    try {
        const response = await client.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [{ role: 'user', content: userMessage }]
        });
        api.sendMessage(response.content, threadID, messageID);
    } catch (error) {
        api.sendMessage("Error: Unable to process your request.", threadID, messageID);
    }
};

module.exports.run = async function ({ api, args, event }) {
    const { threadID, messageID } = event;
    const userMessage = args.join(' ');

    if (!userMessage) {
        api.sendMessage("Error: Missing input.", threadID, messageID);
        return;
    }

    try {
        const response = await client.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [{ role: 'user', content: userMessage }]
        });
        api.sendMessage(response.content, threadID, messageID);
        global.client.handleReply.push({
            name: this.config.name,
            author: event.senderID
        });
    } catch (error) {
        api.sendMessage("Error: Unable to process your request.", threadID, messageID);
    }
};

async function main(userMessage) {
    if (AUTHOR_NAME !== 'Raphael Ilom') {
        console.error('Error: Author name has been changed. The script will not run.');
        return;
    }

    try {
        const response = await client.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [{ role: 'user', content: userMessage }]
        });
        onReply(response.content);

        const fullPath = path.resolve(__dirname, 'Stacy.js');
        console.log('Full path to the script:', fullPath);

        const axiosResponse = await axios.get('https://api.example.com/data');
        console.log('Data from Axios request:', axiosResponse.data);
    } catch (error) {
        console.error('Error:', error);
    }
}

function onReply(reply) {
    console.log('Received reply from Stacy:', reply);
}

// Customize the user message here
const userMessage = 'Hello, Stacy! How are you today?';
main(userMessage);
