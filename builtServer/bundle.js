'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Discord = _interopDefault(require('discord.js'));
var fs = _interopDefault(require('fs'));
var moment = _interopDefault(require('moment'));
var http = _interopDefault(require('http'));
require('opusscript');

let channels = new Map();
let textChannels = new Map();
let stale = true;

const addChannel = (channel) => {
    channels.set(channel.id, channel);
    stale = true;
};

const textChannelMap = () => {
    if (!stale) {
        return textChannels;
    }

    textChannels.clear();

    for (let channel of channels.values()) {
        if (channel && channel.id && channel.type === 'text') {
            textChannels.set(channel.id, channel);
        }
    }

    stale = false;
    return textChannels;
};

const broadcast = (message, channelIds) => {
    let channels = textChannelMap();

    if (!channelIds) {
        for (let channel of channels.values()) {
            sendMessage(channel, message);
        }

        return;
    }

    channelIds.forEach(id => {
        let channel = channels.get(id);

        if (!channel) {
            return;
        }

        sendMessage(channel, message);
    });
};

const broadcastTTS = (message, channelIds) => {
    let channels = textChannelMap();

    if (!channelIds) {
        for (let channel of channels.values()) {
            sendTTSMessage(channel, message);
        }

        return;
    }

    channelIds.forEach(id => {
        let channel = channels.get(id);

        if (!channel) {
            return;
        }

        sendTTSMessage(channel, message);
    });
};

const broadcastToChannel = (message, id) => {
    let channels = textChannelMap();

    let channel = channels.get(id);

    if (!channel) {
        return;
    }

    sendMessage(channel, message);
};

const broadcastTTSToChannel = (message, id) => {
    let channels = textChannelMap();

    let channel = channels.get(id);

    if (!channel) {
        return;
    }

    sendTTSMessage(channel, message);
};

const sendMessage = (channel, message) => {
    channel.send(message).then(message => {
        console.log('Sent message ' + message.content);
    }).catch(error => {
        console.log('Got error ' + error);
    });
};

const sendTTSMessage = (channel, message) => {
    channel.send(message, {
        tts: true
    }).then(message => {
        console.log('Sent message ' + message.content);
    }).catch(error => {
        console.log('Got error ' + error);
    });
};

const embedToChannel = (id, data) => {
    let channels = textChannelMap();

    let channel = channels.get(id);

    if (!channel) {
        return;
    }

    channel.send('', {embed: data}).then(message => {
        console.log('Sent embed.');
    }).catch(error => {
        console.log('Got error ' + error);
    });
};

const hostReg = /http:\/\/([^:\/]*)|https:\/\/([^:\/]*)|^([^:\/]*)/i;
const portReg = /http:\/\/[^:]*:([^\/]*)|https:\/\/[^:]*:([^\/]*)|^[^:]*:([^\/]*)/i;
const pathReg = /http:\/\/[^:]*[^\/]*(.*)|https:\/\/[^:]*[^\/]*(.*)|^[^:]*[^\/]*(.*)/i;

const makeRequest = (method, url, data) => {
    return new Promise((resolve, reject) => {
        const options = {
            host: getHost(url),
            port: getPort(url),
            path: getPath(url),
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        console.log(`sending request ${JSON.stringify(options)}`);

        let request = http.request(options, res => {
            if (res.statusCode <= 200 || res.statusCode >= 300) {
                reject();
                return;
            }

            let response = '';

            res.setEncoding('utf8');
            res.on('data', chunk => {
                response += chunk;
            });

            res.on('end', chunk => {
                resolve(response);
            });
        });

        request.on('error', error => {
            reject(error);
        });

        if (data) {
            request.write(JSON.stringify(data));
        }

        request.end();
    });
};

const getHost = url => {
    let match = url.match(hostReg);

    if (match.length < 2) {
        return '';
    }

    return match[1];
};

const getPort = url => {
    let match = url.match(portReg);

    if (match.length < 2) {
        return 80;
    }

    return parseInt(match[1]);
};

const getPath = url => {
    let match = url.match(pathReg);

    if (match.length < 2) {
        return '';
    }

    return match[1];
};

let actions = new Map();

const addAction = (id, action) => {
    actions.set(id, action);
};

const getAction = id => {
    return actions.get(id);
};

const getActions = () => {
    return new Map(actions);
};

let lastProcess = null;

const process$1 = (action, requester) => {
    var retVal;

    switch (action.type) {
        case "broadcast":
            processBroadcastAction(action);
            break;
        case "broadcastrandom":
            processRandomBroadcastAction(action);
            break;
        case "embed":
            embedToChannel(action.channel, action.embed);
            break;
        case "http":
            processHttpAction(action);
            break;
        case "standard":
            retVal = action.execute(action, requester);
            break;
        case "multiaction":
            processMultiAction(action, requester);
            break;
        case "invokeaction":
            retVal = processInvokeAction(action, requester);
            break;
        default:
            break;
    }

    return retVal;
};

function processBroadcastAction(action) {
    if (action.tts) {
        broadcastTTSAction(action.channel, action.message);
    } else {
        broadcastAction(action.channel, action.message);
    }
}

function processRandomBroadcastAction(action) {
    let message = getRandomMessage(action);

    if (action.tts) {
        broadcastTTSAction(action.channel, message);
    } else {
        broadcastAction(action.channel, message);
    }
}

function broadcastAction(channel, message) {
    if (channel) {
        broadcastToChannel(message, channel);
    } else {
        broadcast(message);
    }
}

function broadcastTTSAction(channel, message) {
    if (channel) {
        broadcastTTSToChannel(message, channel);
    } else {
        broadcastTTS(message);
    }
}

function getRandomMessage(action) {
    let max = action.messages.length - 1;
    let index = Math.floor(Math.random() * max);

    return action.messages[index];
}

function processHttpAction(action) {
    makeRequest(action.method, action.url, action.body).then(data => {
        console.log(`request to ${action.url} succeeded`);
    }).catch(error => {
        console.log(`request to ${action.url} failed with ${error}`);
    });
}

function processMultiAction(action, requester) {
    action.actions.forEach((act, index, arr) => {
        act.channel = action.channel;
        act.server = action.server;
        if (action.extraData) {
            act.extraData = action.extraData;
        }
        runProcess(act, requester);
    });
}

function runProcess(action, requester) {
    if (lastProcess) {
        console.log(`queueing action ${action.id}`);
        lastProcess.then(() => {
            console.log(`running action ${action.id}`);
            let proc = process$1(action, requester);
            if (proc) {
                lastProcess = proc;
            }
        });
        return;
    }

    console.log(`running action ${action.id}`);
    lastProcess = process$1(action, requester);
}

function processInvokeAction(action, requester) {
    let act = getAction(action.id);
    let retVal;

    act.channel = action.channel;
    act.server = action.server;
    if (action.extraData) {
        act.extraData = action.extraData;
    }

    if (act) {
        retVal = process$1(act, requester);
    }

    return retVal;
}

const processActions = actions => {
    actions.forEach((val, i, arr) => {
        if (val.timestamp) {
            setFutureTime(val);
            return;
        }

        if (val.daily) {
            setDailyTime(val);
            return;
        }

        if (val.reoccuring) {
            setReoccuring(val);
            return;
        }

        setDelay(val);
    });
};

const setFutureTime = action => {
    let time = moment(action.timestamp);

    if (!time.isValid()) {
        console.log('Invalid time provided: ' + action.timestamp);
        return;
    }

    let now = new Date();
    let futureTime = time.toDate() - now;

    if (futureTime < 0) {
        return;
    }
    
    setTimeout(() => {
        process$1(action.action);

        if (action.reoccuring) {
            setFutureTime(action);
        }
    }, futureTime);
};

const setDailyTime = action => {
    let time = moment(action.daily, 'HH:mm:ss');

    if (!time.isValid()) {
        console.log('Invalid time provided: ' + action.timestamp);
        return;
    }

    let now = new Date();
    let futureTime = time.toDate() - now;

    if (futureTime < 0) {
        time.add(1, 'days');
        futureTime = time.toDate() - now;
    }
    
    console.log(`Queuing action for ${time.format('YYYY-MM-DD HH:mm')}`);

    setTimeout(() => {
        process$1(action.action);

        setDailyTime(action);
    }, futureTime);
};

const setReoccuring = action => {
    setInterval(() => {
        process$1(action.action);
    }, action.delay);
};

const setDelay = action => {
    setTimeout(() => {
        process$1(action.action);
    }, action.delay);
};

const fullAccess = '*';
let accessMap = new Map();
let defaultAccess = [];
let possibleAccess = [];
let deniedMessage = 'You do not have the rights to perform this action';

const setDefaultAccess = (rights) => {
    defaultAccess = rights;
};

const grantAccess = (user, rights) => {
    let currentRights = accessMap.get(user);

    if (currentRights && currentRights.includes(fullAccess)) {
        return;
    }

    if (rights.includes(fullAccess)) {
        accessMap.set(user, [fullAccess]);
        return;
    }

    if (currentRights) {
        accessMap.set(user, currentRights.concat(rights));   
    } else {
        accessMap.set(user, rights);
    }
};

const revokeAccess = (user, rights) => {
    let currentRights = accessMap.get(user);
    if (!currentRights) {
        return;
    }

    if (currentRights.includes(fullAccess)) {
        currentRights = possibleAccess;
    }
    
    let newRights = currentRights.filter(right => {
        return !rights.includes(right);
    });

    accessMap.set(user, newRights);
};

const hasAccess = (user, right) => {
    let userRights = accessMap.get(user);
    if (!userRights) {
        userRights = defaultAccess;
    }

    if (userRights.includes(fullAccess)) {
        return true;
    }

    let retVal = false;
    userRights.forEach((val, index, arr) => {
        if (retVal) {
            return;
        }

        if (val === right) {
            retVal = true;
        }
    });

    return retVal;
};

const userAccess = (user) => {
    return accessMap.get(user);
};

const setInvalidAccessMessage = (message) => {
    deniedMessage = message;
};

const invalidAccessMessage = () => {
    return deniedMessage;
};

const addPossibleAccess = (accessRights) => {
    possibleAccess = possibleAccess.concat(accessRights);
};

const actionReg = /^!robit\s+([^\s]*)/i;
const extraDataReg = /!robit\s+[^\s]*\s(.*)/i;

const startListening = client => {
    client.on('message', processMessage);
};

function processMessage(message) {
    console.log(`(Channel ${message.channel.id}) ${message.author.username}: ${message.content}`);
    let actionMatch = message.content.match(actionReg);

    if (!actionMatch || actionMatch.length < 2) {
        console.log(`ignoring message ${message.content}`);
        return;
    }

    let action = getAction(actionMatch[1]);

    if (!action) {
        console.log(`unable to find action ${actionMatch[1]}`);
        return;
    }

    let requiredAccess = action.accessOverride ? action.accessOverride : actionMatch[1];
    if (!hasAccess(message.author.username, requiredAccess)) {
        sendMessage$1(invalidAccessMessage(), message.channel.id, message.author);
        return;
    }

    let extraDataMatch = message.content.match(extraDataReg);

    if (!action.channel) {
        action.channel = message.channel.id;
    }

    action.server = message.guild;
    
    if (action.type === 'broadcast' && !action.message && extraDataMatch && extraDataMatch.length >= 2) {
        action.message = extraDataMatch[1];
    } else if (extraDataMatch && extraDataMatch.length >= 2){
        action.extraData = extraDataMatch[1];
    }

    process$1(action, message.author);
}

function sendMessage$1(message, channel, requester) {
    if (channel) {
        broadcastToChannel(message, channel);
        return;
    }

    requester.sendMessage(message).then(() => {
        console.log('Message sent');
    }).catch(err => {
        console.log('Failed to send message');
    });
}

var connection;
const validAudioFile = /\.(mp3|m4a|flac|wav)/i;
let audioFiles = new Map();
let currentSongIndex = 0;
let stopped = false;
let shuffled = false;
let currentSong = {};

const setConnection = conn => {
    connection = conn;
};

const getConnection = () => {
    return connection;
};

const addAudioFiles = dir => {
    console.log(`Searching ${dir} for audio files`);
    getMusicFiles(dir);
};

function getMusicFiles(dir) {
    let files = fs.readdirSync(dir);

    files.forEach(file => {
        let path = `${dir}/${file}`;
        if (fs.statSync(path).isDirectory()) {
            walkDir(path);
            return;
        }

        if (!validAudioFile.test(file)) {
            return;
        }

        let index = file.lastIndexOf('.');
        let name = file;

        if (index !== -1) {
            name = file.substring(0, index);
        }

        console.log(`Adding file ${name} with path ${path}`);
        audioFiles.set(name, path);
    });
}

const shuffle = () => {
    shuffled = !shuffled;

    if (stopped) {
        play();
    }

    return shuffled;
};

const play = song => {
    if (!connection) {
        console.log('Unable to play song since connection does not exist');
        return;
    }

    stopped = false;
    let file = getAudioFile(song);

    console.log(`Attempting to play file ${file.value[1]}`);
    currentSong.name = file.value[0];
    currentSong.stream = connection.playFile(file.value[1]);
    currentSong.stream.once('end', () => {
        if (!stopped) {
            play();
        }
    });
};

function getAudioFile(song) {
    if (song) {
        return audioFiles.get(song);
    }

    let targetIndex = currentSongIndex;

    if (shuffled) {
        targetIndex = Math.floor(Math.random() * audioFiles.size);
    }

    let iter = 0;
    let fileIter = audioFiles.entries();

    while (iter < targetIndex) {
        fileIter.next();
        iter++;
    }

    let file = fileIter.next();

    if (shuffled) {
        return file;
    }

    currentSongIndex++;

    if (currentSongIndex > audioFiles.size) {
        currentSongIndex = 0;
    }

    return file;
}

const stop = () => {
    stopped = true;
    if (currentSong.stream) {
        currentSong.stream.end('User ended song');
        currentSong = {};
    }
};

const currentSongName = () => {
    if (currentSong.name) {
        return currentSong.name;
    }

    if (stopped) {
        return 'No song is playing.';
    }

    return 'Unknown';
};

const nextSong = () => {
    if (stopped) {
        return false;
    }

    if (!currentSong.stream) {
        return false;
    }

    currentSong.stream.end('User invoked next song');
    return true;
};

let actions$1 = [];
let lastAction = null;

const addShutdownAction = action => {
    actions$1.push(action);
};

const executeShutdown = () => {
    for (let i = actions$1.length - 1; i >= 0; --i) {
        runAction(actions$1[i]);
    }
};

function runAction(action) {
    if (lastAction) {
        console.log('queueing action');
        lastAction.then(action);
        return;
    }

    lastAction = action();
}

class MessageSender {
    sendMessageToRequester(message, requester) {
        requester.sendMessage(message).then(() => {
            console.log('Message sent');
        }).catch(err => {
            console.log('Failed to send message');
        });
    }

    sendMessageToChannel(message, action, requester) {
        if (action.channel) {
            broadcastToChannel(message, action.channel);
            delete action.channel;
            return;
        }

        requester.sendMessage(message).then(() => {
            console.log('Message sent');
        }).catch(err => {
            console.log('Failed to send message');
        });
    }
}

class HelpAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return `Command used to display information about other commands.
        Usage: help {command name here}
        Available commands: ${this.getCommands()}`;
    }

    getCommands() {
        var retVal = '';
        getActions().forEach((value, key, map) => {
            retVal += key + ' ';
        });

        return retVal;
    }

    execute(action, requester) {
        if (!action.extraData) {
            this.sendMessageToRequester(this.help, requester);
            return;
        }
    
        let act = getAction(action.extraData);
    
        if (!act || !act.help) {
            this.sendMessageToRequester(`No help available for ${action.extraData}`, requester);
            return;
        }
    
        this.sendMessageToRequester(act.help, requester);
    }
}

var help = new HelpAction();

const createVoiceChannel = (server, name) => {
    return server.createChannel(name, 'voice');
};

class PlayMusicAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'starts playing music';
    }

    execute(action, requester) {
        if (getConnection()) {
            play(action.extraData);
            return;
        }

        return new Promise((resolve, reject) => {
            createVoiceChannel(action.server, 'Music').then(channel => {
                this.sendMessageToChannel('Music channel has been created', action, requester);

                addShutdownAction(() => {
                    return channel.delete().then(chan => {
                        console.log('Deleted channel');
                    }).catch(error => {
                        console.log(`Got error deleteing channel ${error}`);
                    });
                });

                this._startAudio(channel, action.extraData).then(() => {
                    resolve();
                });
            }).catch(error => {
                console.log(`Unable to create music channel ${error}`);
                reject(error);
            });
        });
    }

    _startAudio(channel, song) {
        console.log(`Attempting to join voice channel ${channel}`);

        return channel.join().then(connection => {
            console.log(`Joined voice channel ${channel}`);
            setConnection(connection);
            play(song);
        }).catch(error => {
            console.log(`Unable to join voice channel ${error}`);
        });
    }
}

var playMusic = new PlayMusicAction();

class StopMusicAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'stops playing music';
    }

    execute(action, requester) {
        stop();
        this.sendMessageToChannel('Music has been stopped', action, requester);
    }
}

var stopMusic = new StopMusicAction();

class StopMusicAction$1 extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Gets information about the currently playing song.';
    }

    execute(action, requester) {
        this.sendMessageToChannel(`Current song is: ${currentSongName()}`, action, requester);
    }
}

var musicInfo = new StopMusicAction$1();

class NextSongAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Moves to the next song.';
    }

    execute(action, requester) {
        if (nextSong()) {
            this.sendMessageToChannel(`Moved to next song`, action, requester);
            return;
        }

        this.sendMessageToChannel('Unable to move to the next song', action, requester);
    }
}

var nextSong$1 = new NextSongAction();

class ShutdownAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Shuts down robit.';
    }

    execute(action, requester) {
        this.sendMessageToChannel('Shutting down robit', action, requester);
        executeShutdown();
    }
}

var shutdown = new ShutdownAction();

class ShuffleMusicAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'starts or stops shuffling music';
    }

    execute(action, requester) {
        if (!getConnection()) {
            this.sendMessageToChannel(`Unable to shuffle music. Music must be started first.`, action, requester);
            return;
        }

        let shuf = shuffle() ? 'now' : 'no longer';
        this.sendMessageToChannel(`Music is ${shuf} shuffled`, action, requester);
    }
}

var shuffleMusic = new ShuffleMusicAction();

const userReg = /-u\s+([^\s"]+)|-u\s+"([^"]*)"/i;
const singleAccessReg = /-a\s+([^\s\[]+)/i;
const arrayAccessReg = /-a\s+\[([^\]]+)\]/i;

class GrantAccessAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Gives a user access to actions'
    }

    get accessOverride() {
        return fullAccess;
    }

    execute(action, requester) {
        let user = this._getUser(action.extraData);
        let access = this._getAccess(action.extraData);

        if (!user || !access) {
            this.sendMessageToRequester('Invalid request see help for usage', requester);
            return;
        }

        console.log(`attempting to give ${user} rights ${access}`);
        grantAccess(user, access);
    }

    _getUser(args) {
        let match = args.match(userReg);
        if (!match || match.length < 1) {
            return;
        }

        return match[1];
    }

    _getAccess(args) {
        let match = args.match(singleAccessReg);
        if (match && match.length > 0) {
            return [match[1]];
        }

        match = args.match(arrayAccessReg);
        if (!match || match.length < 1) {
            return;
        }

        return match[1].split(', ');
    }
}

var grantAccess$1 = new GrantAccessAction();

class UserAccessAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Gets a users access to actions'
    }

    execute(action, requester) {
        if (action.extraData && !hasAccess(requester.username, fullAccess)) {
            this.sendMessageToRequester(`You do not have access to view access of user ${action.extraData}`, requester);
            return;
        }

        let user = action.extraData ? action.extraData : requester.username;
        let access = userAccess(user);

        if (!access) {
            access = 'Nothing';
        } else {
            access = access.join(', ');
        }

        this.sendMessageToRequester(`${user} has access to ${access}`, requester);
    }
}

var userAccess$1 = new UserAccessAction();

const userReg$1 = /-u\s+([^\s"]+)|-u\s+"([^"]*)"/i;
const singleAccessReg$1 = /-a\s+([^\s\[]+)/i;
const arrayAccessReg$1 = /-a\s+\[([^\]]+)\]/i;

class RevokeAccessAction extends MessageSender {
    get type() {
        return 'standard';
    }

    get help() {
        return 'Gets a users access to actions'
    }

    get accessOverride() {
        return fullAccess;
    }

    execute(action, requester) {
        let user = this._getUser(action.extraData);
        let access = this._getAccess(action.extraData);

        if (!user || !access) {
            this.sendMessageToRequester('Invalid request see help for usage', requester);
            return;
        }

        console.log(`attempting to revoke ${user} rights ${access}`);
        revokeAccess(user, access);
    }

    _getUser(args) {
        let match = args.match(userReg$1);
        if (!match || match.length < 1) {
            return;
        }

        return match[1];
    }

    _getAccess(args) {
        let match = args.match(singleAccessReg$1);
        if (match && match.length > 0) {
            return [match[1]];
        }

        match = args.match(arrayAccessReg$1);
        if (!match || match.length < 1) {
            return;
        }

        return match[1].split(', ');
    }
}

var revokeAccess$1 = new RevokeAccessAction();

let actions$2 = [
    { 
        id: 'help',
        action: help
    },
    {
        id: 'playmusic',
        action: playMusic
    },
    {
        id: 'stopmusic',
        action: stopMusic
    },
    {
        id: 'currentsong',
        action: musicInfo
    },
    {
        id: 'nextsong',
        action: nextSong$1
    },
    {
        id: 'shufflemusic',
        action: shuffleMusic
    },
    {
        id: 'shutdown',
        action: shutdown
    },
    {
        id: 'grantaccess',
        action: grantAccess$1
    },
    {
        id: 'revokeaccess',
        action: revokeAccess$1
    },
    {
        id: 'useraccess',
        action: userAccess$1
    }
];

let ids = [];
actions$2.forEach((action, i, arr) => {
    ids.push(action.id);
    addAction(action.id, action.action);
});

addPossibleAccess(ids);

const client = new Discord.Client();
let configFile = '';
let config = {};

process.argv.forEach((val, i, arr) => {
    if (val.endsWith('json')) {
        configFile = val;
    }
});

if (!configFile) {
    throw 'No Config provided'; 
}

fs.readFile(configFile, 'utf8', (err, data) => {
    if (err) {
        console.log('Got error ' + err);
        return;
    }

    config = JSON.parse(data);
    startServer();
});

const startServer = () => {
    client.login(config.token).then(() => {
        console.log('logged in.');
    
        client.channels.forEach(channel => {
            console.log(`Found channel ${channel.id} with type ${channel.type} and name ${channel.name} on server ${channel.server}`);
    
            addChannel(channel);
        });
    
        broadcast(config.greeting);
        processConfig();
        startListening(client);
        addShutdownAction(() => {
            console.log('exiting process');
            process.exit(0);
        });
    }).catch(error => {
        console.log('login failed ' + error);
        process.exit(1);
    });
};

const processConfig = () => {
    processActions(config.deferredactions);

    let actionIds = [];
    config.actions.forEach((val, i, arr) => {
        actionIds.push(val.id);
        addAction(val.id, val.action);
    });
    addPossibleAccess(actionIds);

    if (!config.audioSources) {
        return;
    }

    config.audioSources.forEach((source, index, arr) => {
        addAudioFiles(source);
    });

    if (config.access) {
        processAccess(config.access);
    }
};

function processAccess(access) {
    if (access.default) {
        setDefaultAccess(access.default);
    }

    if (access.deniedMessage) {
        setInvalidAccessMessage(access.deniedMessage);
    }

    if (!access.users) {
        return;
    }

    access.users.forEach((val, index, arr) => {
        grantAccess(val.name, val.rights);
    });
}
