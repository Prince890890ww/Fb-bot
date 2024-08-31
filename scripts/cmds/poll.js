  module.exports.config = {
  name: "poll",
  aliases: ["vote"],
  hasPermission: 0,
  version: "1.1",
  credits: "Raphael ilom (Enhanced by Assistant)",
  cooldowns: 5,
  usePrefix: true,
  description: "Create an interactive poll with multiple options.",
  commandCategory: "Utility",
  usages: "[question] | [option1] | [option2] | ... | [optionN]"
};

module.exports.run = async function ({ api, args, event, Users }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(' ').split('|').map(item => item.trim());

  if (input.length < 3) {
    return api.sendMessage("Please provide a question and at least two options.", threadID, messageID);
  }

  const [question, ...options] = input;

  if (options.length > 10) {
    return api.sendMessage("You can only have up to 10 options in a poll.", threadID, messageID);
  }

  let pollMessage = `📊 Poll: ${question}\n\n`;
  const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  options.forEach((option, index) => {
    pollMessage += `${reactions[index]} ${option}\n`;
  });

  pollMessage += "\nReact to vote!";

  const userName = await Users.getNameUser(senderID);
  pollMessage += `\n\nCreated by: ${userName}`;

  api.sendMessage(pollMessage, threadID, (err, info) => {
    if (err) return console.error(err);

    options.forEach((_, index) => {
      api.setMessageReaction(reactions[index], info.messageID, (err) => {}, true);
    });

    // Store poll data for later use
    global.client.polls = global.client.polls || {};
    global.client.polls[info.messageID] = {
      question,
      options,
      votes: {},
      creator: senderID,
      threadID
    };

    // Set a timer to end the poll after 1 hour
    setTimeout(() => endPoll(api, info.messageID), 3600000);
  });
};

async function endPoll(api, messageID) {
  const poll = global.client.polls[messageID];
  if (!poll) return;

  let resultMessage = `📊 Poll Results: ${poll.question}\n\n`;
  const totalVotes = Object.values(poll.votes).reduce((sum, votes) => sum + votes.length, 0);

  poll.options.forEach((option, index) => {
    const votes = poll.votes[index] ? poll.votes[index].length : 0;
    const percentage = totalVotes > 0 ? (votes / totalVotes * 100).toFixed(2) : 0;
    resultMessage += `${option}: ${votes} votes (${percentage}%)\n`;
  });

  resultMessage += `\nTotal votes: ${totalVotes}`;

  api.sendMessage(resultMessage, poll.threadID);
  delete global.client.polls[messageID];
}

module.exports.handleReaction = async function ({ api, event, Users }) {
  const { messageID, userID, reaction } = event;
  const poll = global.client.polls[messageID];
  if (!poll) return;

const reactionIndex = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'].indexOf(reaction);

  if (reactionIndex === -1) return;

  // Remove previous vote if exists
  Object.keys(poll.votes).forEach(optionIndex => {
    poll.votes[optionIndex] = poll.votes[optionIndex].filter(voter => voter !== userID);
  });

  // Add new vote
  poll.votes[reactionIndex] = poll.votes[reactionIndex] || [];
  poll.votes[reactionIndex].push(userID);

  // Update poll message
  let updatedMessage = `📊 Poll: ${poll.question}\n\n`;
  poll.options.forEach((option, index) => {
    const votes = poll.votes[index] ? poll.votes[index].length : 0;
    updatedMessage += `${['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index]} ${option} (${votes} votes)\n`;
  });

  updatedMessage += "\nReact to vote!";
  const creatorName = await Users.getNameUser(poll.creator);
  updatedMessage += `\n\nCreated by: ${creatorName}`;

  api.editMessage(updatedMessage, messageID);
};
