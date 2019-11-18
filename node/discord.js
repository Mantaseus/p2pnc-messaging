const Discord = require('discord.js');
const fetch = require('node-fetch');
const _ = require('lodash');
const debug = require('debug')('messaging:discord');

// HELPERS ----------------------------------------------------------------------------------------

function splitMessage(id, msg, charLimit) {
    // TODO if the `msg` has more characters than discord allows in a single message then
    //      Break apart `msg` into appropriately sized chunks
    //      Surround the pieces with text to identify that the pieces are from the same session
    // else
    //      Start the `msg` with the id
    //      Make sure that it now does not exceed the limit
    //          We will need to break it up if it does

    return [msg];
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
