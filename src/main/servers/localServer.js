import fs from 'fs';
import { spawn } from 'child_process';
import https from 'https';
import moment from 'moment';
import { broadcast } from '@jeffriggle/ipc-bridge-server';
import { getProcessUsage } from '../helpers/processUsage';
import { sendServerHealth } from '../helpers/notifications';
import events from '../events';
import { updateStateAndBroadCast } from '../serverState';
import { Octokit } from '@octokit/rest';
const octokit = new Octokit();

const appData = process.env.APPDATA || (process.platform == 'darwin' ? `${process.env.HOME}/Library/Preferences` : process.env.HOME);
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

function dowloadFile(uri, destination) {
    return new Promise((resolve, reject) => {
        console.log('Downloading ', uri, ' to ', destination);
        const file = fs.createWriteStream(destination);
        https.get(uri, response => {
            if (response.statusCode === 302) {
                https.get(response.headers.location, response => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }
        });
    });
}

function spawnLocalServer(dir, config) {
    console.log('Creating local server');
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
        octokit.repos.getRelease({
            owner: 'JeffreyRiggle',
            repo: 'somerobit',
            release_id: 'latest'
        }).then(result => {
            const asset = result.data.assets.filter(asset => asset.name === 'bundle.js');
            dowloadFile(asset[0].browser_download_url, `${dir}/server.js`).then(() => {
                spawnLocalServer(dir, config);
                resolve({ success: true });
            });
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