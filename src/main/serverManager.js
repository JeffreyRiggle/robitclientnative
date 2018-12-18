import fs from 'fs';
import { spawn } from 'child_process';
import { registerEvent, broadcast } from './ipcBridge';

const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
const dir = appData + '/robitserver';
const serverContents = fs.readFileSync(__dirname + '/../../builtServer/bundle.js');
const stateevent = 'serverstate';

let childProc;
let state = 'stopped';

function startServer(event, config) {
    updateStateAndBroadCast('loading');

    if (childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot start process it is already started');
        return;
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    console.log('Starting robit server');
    fs.writeFileSync(dir + '/server.js', serverContents);
    fs.writeFileSync(dir + '/config.json', JSON.stringify(config));
    childProc = spawn('node', [`${dir}/server.js`,  `${dir}/config.json`], {
        detached: true,
        stdio: 'ignore'
    });

    updateStateAndBroadCast('started');
}

function stopServer() {
    if (!childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot kill process it is not running');
        return;
    }

    childProc.kill();
    childProc = null;
    updateStateAndBroadCast('stopped');
}

function updateStateAndBroadCast(newstate) {
    state = newstate;
    broadcast(stateevent, state);
}

function getServerState(event) {
    console.log(`Handling server state request current state is ${state}`);
    event.send(stateevent, state);
}

registerEvent('startserver', startServer);
registerEvent('stopserver', stopServer);
registerEvent(stateevent, getServerState);