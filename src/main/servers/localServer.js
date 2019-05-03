import fs from 'fs';
import { spawn } from 'child_process';
import request from 'request';
import moment from 'moment';
import { broadcast } from '@jeffriggle/ipc-bridge-server';
import { getProcessUsage } from '../helpers/processUsage';
import { sendServerHealth } from '../helpers/notifications';
import events from '../events';
import { updateStateAndBroadCast } from '../serverState';

const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
const dir = appData + '/robitserver';

let serverUsagePoll, upTime, childProc, serverContents;

function notifyServerHealth() {
    getProcessUsage(childProc).then(data => {
        sendServerHealth(data.memory, data.cpu, upTime);
    }).catch(err => {
        console.log(err);
        sendServerHealth(null, null, upTime);
    });
}

function startPollingServerUsage() {
    upTime = Date.now();
    notifyServerHealth();

    serverUsagePoll = setInterval(() => {
        notifyServerHealth();
    }, 10000);
}

function serverCleanUp() {
    childProc = null;

    if (serverUsagePoll) {
        clearInterval(serverUsagePoll);
        serverUsagePoll = null;
        upTime = null;
    }

    updateStateAndBroadCast('stopped');
    sendServerHealth();
}

function spawnLocalServer(dir, config) {
    fs.writeFileSync(dir + '/server.js', serverContents);
    fs.writeFileSync(dir + '/config.json', JSON.stringify(config));
    childProc = spawn('node', [`${dir}/server.js`,  `${dir}/config.json`]);

    childProc.on('error', err => {
        console.log(`Server got error ${err}`);
    });

    childProc.on('exit', () => {
        console.log('Server was killed.');
        serverCleanUp();
    });

    childProc.stdout.on('data', (data) => {
        console.log(`Got data from child process: ${data}`);
        broadcast(events.serverData, `${moment().format('HH:mm:ss.SSS')} : ${data}`);
    });

    updateStateAndBroadCast('started');
    startPollingServerUsage();
}

function fetchAndStartServer(dir, config) {
    return new Promise((resolve, reject) => {
        console.log('Server contents are unknown fetching those now');
        request.get('https://raw.githubusercontent.com/JeffreyRiggle/somerobit/master/dist/bundle.js', (err, response, body) => {
            if (err) {
                reject(err);
                return;
            }

            serverContents = body;
            spawnLocalServer(dir, config);
            resolve({ success: true });
        });
    });
}

const startLocalServer = (config) => {
    if (childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot start process it is already started');
        return {
            success: false
        };
    }

    console.log('Attempting to start local server.');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    console.log(`Starting robit server in location ${dir}`);
    if (serverContents) {
        spawnLocalServer(dir, config);
        return { success: true };   
    }
    
    return fetchAndStartServer(dir, config);
}

const stopLocalServer = () => {
    if (!childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot kill process it is not running');
        return;
    }

    childProc.kill();
    serverCleanUp();

    return {
        success: true
    };
}

export {
    startLocalServer,
    stopLocalServer
}