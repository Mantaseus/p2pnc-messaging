const debug = require('debug')('messaging:manual');

// MODULE CODE ------------------------------------------------------------------------------------

module.exports.isListening = false;
module.exports.config = null

module.exports.init = (config) => {
}

module.exports.sendMessage = (msg, callback) => {
}

module.exports.startListening = (callbackReady, callbackMessage) => {
    module.exports.isListening = true;
}

module.exports.stopListening = () => {
    module.exports.isListening = false;
}
