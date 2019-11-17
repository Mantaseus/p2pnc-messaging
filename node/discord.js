const Discord = require('discord.js');
const fetch = require('node-fetch');

const debug = require('debug')('messaging:discord');

// MODULE CODE ------------------------------------------------------------------------------------

module.exports.isListening = false;
module.exports.config = null
module.exports._discordClient = null;

module.exports.init = (config, isClient=true) => {
    module.exports.config = config;
    module.exports.isClient = isClient;
}

module.exports.sendMessage = (msg, callback) => {
    const config = module.exports.config;

    let auth = config.discordClientBot.token;
    if (!module.exports.isClient)
        auth = config.discordServerBot.token;
        
    fetch(`https://discordapp.com/api/channels/${config.discordChannelId}/messages`, {
        method: 'post',
        body: JSON.stringify({
            content: msg
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${auth}`
        }
    }).then((res) => { callback(res) });
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
                callbackMessage(msg.content);
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
