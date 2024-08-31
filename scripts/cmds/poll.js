module.exports.config = {
  name: "poll",
  aliases: ["vote"],
  hasPermission: 0,
  version: 1.1,
  credits: "Raphael ilom",
  cooldowns: 5,
  usePrefix: true,
  description: "Create an interactive poll with customizable options.",
  commandCategory: "Utility",
  usages: "[question] | [option1] | [option2] | ... | [duration in minutes]"
};

module.exports.run = async function ({ api, args, event, Users }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(' ').split('|').map(item => item.trim());

  if (input.length < 3) {
    return api.sendMessage("Please provide a question and at least two options.", threadID, messageID);
  }

  const [question, ...optionsAndDuration] = input;
  const duration = parseInt(optionsAndDuration[optionsAndDuration.length - 1]);
  const options = isNaN(duration) ? optionsAndDuration : optionsAndDuration.slice(0, -1);

  if (options.length < 2 || options.length > 10) {
    return api.sendMessage("Please provide between 2 and 10 options.", threadID, messageID);
  }

  const pollDuration = isNaN(duration) ? 5 : Math.min(Math.max(duration, 1), 1440);
  let pollMessage = `📊 Poll: ${question}\n\n`;

  options.forEach((option, index) => {
    pollMessage += `${index + 1}. ${option}\n`;
  });

  pollMessage += `\nPoll duration: ${pollDuration} minute(s)`;

  const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const votes = new Map();

  api.sendMessage(pollMessage, threadID, async (err, info) => {
    if (err) return console.error(err);

    for (let i = 0; i < options.length; i++) {
      await api.setMessageReaction(reactions[i], info.messageID, (err) => {}, true);
    }

    const pollEndTime = Date.now() + pollDuration * 60000;

    const checkPollEnd = setInterval(async () => {
      if (Date.now() >= pollEndTime) {
        clearInterval(checkPollEnd);
        const pollResults = await calculateResults(api, info.messageID, options, votes);
        api.sendMessage(pollResults, threadID);
      }
    }, 10000);

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);

      if (event.type === "message_reaction" && event.messageID === info.messageID) {
        const reactionIndex = reactions.indexOf(event.reaction);
        if (reactionIndex !== -1) {
          const userID = event.userID;
          votes.set(userID, reactionIndex);
        }
      }
    });
  });
};

async function calculateResults(api, messageID, options, votes) {
  const results = new Array(options.length).fill(0);
  votes.forEach((optionIndex) => {
    results[optionIndex]++;
  });

  let resultMessage = "📊 Poll Results:\n\n";
  const totalVotes = results.reduce((sum, count) => sum + count, 0);

  options.forEach((option, index) => {
    const voteCount = results[index];
    const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).toFixed(2) : 0;
    resultMessage += `${index + 1}. ${option}: ${voteCount} vote(s) (${percentage}%)\n`;
  });

  resultMessage += `\nTotal votes: ${totalVotes}`;

  return resultMessage;
}
