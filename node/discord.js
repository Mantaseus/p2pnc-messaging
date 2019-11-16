const Discord = require('discord.js');
const fetch = require('node-fetch');

const debug = require('debug')('messaging:discord');

// MODULE CODE ------------------------------------------------------------------------------------

module.exports.isListening = false;
module.exports.config = null
module.exports._discordClient = null;

module.exports.init = (config) => {
    module.exports.config = config;
}

module.exports.sendMessage = (msg, callback) => {
    const config = module.exports.config;

    fetch(`https://discordapp.com/api/channels/${config.discordChannelId}/messages`, {
        method: 'post',
        body: JSON.stringify({
            content: msg
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${config.discordClientBot.token}`
        }
    }).then((res) => { callback(res) });
}

module.exports.startListening = (callbackReady, callbackMessage) => {
    const discordClient = new Discord.Client();
    const config = module.exports.config;
    
    discordClient.on('ready', () => {
        debug('Discord ready');
        module.exports.isListening = true;
        callbackRead();
    });
    
    discordClient.on('message', (msg) => {
        if (peerClient && !peerClient.connected && msg.author.tag === config.discordServerBot.tag){
            debug('Discord message received from server');
            debug(msg.content)

            if (module.exports.isListening) {
                debug('Sending message to callback');
                callbackMessage(msg.content);
            } else {
                debug('Listening has been stopped');
            }
        }
    });
    
    discordClient.login(config.discordClientBot.token);
    module.exports._discordClient = discordClient;
}

module.exports.stopListening = () => {
    module.exports.discordClient.destroy();
    module.exports.isListening = false;
}
