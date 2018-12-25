import fs from 'fs';
import { spawn, exec } from 'child_process';
import { registerEvent, broadcast } from './ipcBridge';
import serverContents from 'raw-loader!../../builtServer/bundle';

const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
const dir = appData + '/robitserver';
const stateevent = 'serverstate';
const dayInterval = 1 * 24 * 60 * 60 * 1000;
const hourInterval = 1 * 60 * 60 * 1000;
const minuteInterval = 1 * 60 * 1000;
const secondInterval = 1000;

let childProc, serverUsagePoll, upTime;
let state = 'stopped';

function formatUpTime(ms) {
    let days = 0, hours = 0, minutes = 0, seconds = 0;

    while(ms >= dayInterval) {
        days++;
        ms -= dayInterval;
    }

    while(ms >= hourInterval) {
        hours++;
        ms -= hourInterval
    }

    while(ms >= minuteInterval) {
        minutes++;
        ms -= minuteInterval
    }

    while(ms >= secondInterval) {
        seconds++;
        ms -= secondInterval;
    }

    return `${days}:${hours <= 9 ? '0' : ''}${hours}:${minutes <= 9 ? '0' : ''}${minutes}:${seconds <= 9 ? '0' : ''}${seconds}:${ms}`
}

function sendServerHealth(memory, cpu) {
    let liveTime = 'N/A';

    if (upTime) {
        liveTime = formatUpTime((Date.now() - upTime));
    }

    broadcast('serverhealth', {
        memory: memory ? memory : 'N/A',
        cpu: cpu ? cpu : 'N/A',
        upTime: liveTime
    });
}

function getServerUsage() {
    if (process.platform !== 'win32') {
        console.log(`Health check is not supported on ${process.platform}`);
        sendServerHealth();
        return;
    }

    exec(`tasklist /v /fi "PID eq ${childProc.pid}" /fo csv`, (err, stdout, stderr) => {
        if (err) {
            console.log(`Got error ${err} when attempting to read task list`);
            return;
        }

        let info = stdout.toString().split('\n')[1];
        let [imageName, procId, sessionName, sessionNum, mem, status, userName, cpu, title] = info.split('","');

        sendServerHealth(mem, cpu);
    });
}

function startPollingServerUsage() {
    upTime = Date.now();
    getServerUsage();
    serverUsagePoll = setInterval(() => {
        getServerUsage();
    }, 10000);
}

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

    childProc.on('error', err => {
        console.log(`Server got error ${err}`);
    });

    childProc.on('exit', () => {
        console.log('Server was killed.');
        serverCleanUp();
    });

    updateStateAndBroadCast('started');
    startPollingServerUsage();
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

function stopServer() {
    if (!childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot kill process it is not running');
        return;
    }

    childProc.kill();
    serverCleanUp();
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