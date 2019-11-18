const Discord = require('discord.js');
const fetch = require('node-fetch');
const _ = require('lodash');
const debug = require('debug')('messaging:discord');

// GLOBALS ----------------------------------------------------------------------------------------

const SESSION_MESSaGES_TIMEOUT = 60 * 1000; // 60 seconds

sessions = {};

// HELPERS ----------------------------------------------------------------------------------------

function splitMessage(id, msg, charLimit) {
    /*
    We will reserve the first 20 characters of each message for identification of the session. Each
    message would end up looking like this: 
         `{id},{msg_index},{message_count}|{msg_piece}`

        - `id` will always be truncated to 13 characters (leftmost characters will be removed)
        - `msg_count` is the total number of messages in this session (will be 0 padded, max 99)
        - `msg_index` is the index of the current message (starting at 0, will be 0 padded, max 99)
        - `msg_piece` is the actual piece of the `msg` content we are trying to send
    */

    const headerSize = 20;
    const msgPieceMaxSize = charLimit - headerSize;

    let msgSplit = msg.match(new RegExp(`.{1,${msgPieceMaxSize}}`, 'g'));
    msgSplit = _.map(msgSplit, (split, i) => {
        // Discord strips out ending spaces, so we will replace them with a '`' character and hope
        // that the split does not end with an intentional '`' character
        split = split.replace(/\s+$/g, '`');

        return `${id},${i},${msgSplit.length}|${split}`;
    });


    return msgSplit;
}

async function sendDiscordMessage(msg, channelId, auth) {
    await fetch(`https://discordapp.com/api/channels/${channelId}/messages`, {
        method: 'post',
        body: JSON.stringify({
            content: msg
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${auth}`
        }
    });
}

function processSession(id, split, splitIndex, splitCount) {
    /*
    Returns false if the splitCount has not been fulfilled yet with this new split
        - Adds the session data to `sessions` array
    Returns the joined message if the splitCount has been satisfied
    */

    if (sessions[id]) {
        if (_.size(sessions[id].splits) >= splitCount - 1) {
            // We got the final split. Merge them all and delete the session object

            sessions[id].splits[splitIndex] = split;

            let fullMessage = '';
            _.each(_(sessions[id].splits).keys().sortBy().value(), (index) => {
                fullMessage += sessions[id].splits[index].toString();
            });

            delete sessions[id];

            return fullMessage;
        } else {
            // We still need more splits
            sessions[id].splits[splitIndex] = split;
        }
    } else {
        if (splitCount === 1) {
            // Do not need to do anything special because this is the one and only split we expect
            return split
        } else {
            // Start a new session
            sessions[id] = {
                splitCount: splitCount,
                splits: {}
            }

            // Add the split at the split index
            sessions[id].splits[splitIndex] = split;
        }
    }

    return false;
}

// MODULE CODE ------------------------------------------------------------------------------------

module.exports.isListening = false;
module.exports.config = null
module.exports._discordClient = null;

module.exports.init = (config, isClient=true) => {
    module.exports.config = config;
    module.exports.isClient = isClient;
}

module.exports.sendMessage = async (msg, callback, id='') => {
    const config = module.exports.config;

    let auth = config.discordClientBot.token;
    if (!module.exports.isClient)
        auth = config.discordServerBot.token;

    // Create a new id if the id that is passed in is empty
    if (!id) {
        const date = new Date();
        id = date.getTime();
    }

    // Split the message to work around the discord character limit
    msgList = splitMessage(id, msg, config.discordCharacterLimit);
    for (i in msgList) {
        await sendDiscordMessage(msgList[i], config.discordChannelId, auth);
    }
}

module.exports.startListening = (callbackReady, callbackMessage) => {
    const discordClient = new Discord.Client();
    const config = module.exports.config;
    
    let auth = config.discordClientBot.token;
    let tagOfTheOther = config.discordServerBot.tag;
    if (!module.exports.isClient) {
        auth = config.discordServerBot.token;
        tagOfTheOther = config.discordClientBot.tag;
    }
        
    discordClient.on('ready', () => {
        debug('Discord ready');
        module.exports.isListening = true;
        callbackReady();
    });
    
    discordClient.on('message', (msg) => {
        if (msg.author.tag === tagOfTheOther){
            debug('Discord message received from server');
            debug(msg.content)

            // Deconstruct the information out of the message
            const regexGroups = /(\d+),(\d+),(\d+)\|(.*)/g.exec(msg.content);
            const id = parseInt(regexGroups[1]);
            const splitIndex = parseInt(regexGroups[2]);
            const splitCount = parseInt(regexGroups[3]);
            const split = regexGroups[4];

            // Convert any '`' at the end of the split to a ' '. But there may be more than 1 '`'
            // so we need to replace them all with just as many ' '
            endingSpaces = /(`+)$/g.exec(split);
            if (endingSpaces) {
                split.replace(/`+$/g, endingSpaces[1].replace('`', ' '));
            }

            const splitMerge = processSession(id, split, splitIndex, splitCount);
            if (!splitMerge) {
                return;
            }

            if (module.exports.isListening) {
                debug('Sending message to callback');
                callbackMessage(splitMerge, (response, onSuccess) => {
                    module.exports.sendMessage(response, onSuccess, id);
                });
            } else {
                debug('Listening has been stopped');
            }
        }
    });
    
    discordClient.login(auth);
    module.exports._discordClient = discordClient;
}

module.exports.stopListening = () => {
    module.exports.discordClient.destroy();
    module.exports.isListening = false;
}
