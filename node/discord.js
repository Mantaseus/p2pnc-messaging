const Discord = require('discord.js');
const fetch = require('node-fetch');
const _ = require('lodash');
const debug = require('debug')('messaging:discord');

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
        return `${id},${i},${msgSplit.length}|${split}`;
    });

    console.log(msgSplit);
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

            if (module.exports.isListening) {
                debug('Sending message to callback');
                callbackMessage(msg.content, (response, onSuccess) => {
                    module.exports.sendMessage(response, onSuccess);
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
