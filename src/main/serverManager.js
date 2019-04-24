import fs from 'fs';
import { spawn, exec } from 'child_process';
import { registerEvent, broadcast } from '@jeffriggle/ipc-bridge-server';
import moment from 'moment';
import request from 'request';

const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
const dir = appData + '/robitserver';
const stateevent = 'serverstate';
const serverEvent = 'serverdata';
const dayInterval = 1 * 24 * 60 * 60 * 1000;
const hourInterval = 1 * 60 * 60 * 1000;
const minuteInterval = 1 * 60 * 1000;
const secondInterval = 1000;
const linuxMemoryReg = /VmSize:\s*([\d\skBmg]*)/;

let childProc, serverUsagePoll, upTime;
let state = 'stopped';
let serverContents;

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

function getLinuxHealth() {
    fs.readFile(`/proc/${childProc.pid}/status`, (err, data) => {
        let memory = linuxMemoryReg.exec(data.toString())[1];
        
        exec(`ps -p ${childProc.pid} -o %cpu`, (err, stdout) => {
            let cpu = stdout.replace('%CPU', '') + '%';
            sendServerHealth(memory, cpu);
        });
    });
}

function getWindowsHealth() {
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

function getServerUsage() {
    if (process.platform === 'linux') {
        getLinuxHealth();
        return;
    }
    if (process.platform === 'win32') {
        getWindowsHealth();
        return;
    }

    console.log(`Health check is not supported on ${process.platform}`);
    sendServerHealth();
}

function startPollingServerUsage() {
    upTime = Date.now();
    getServerUsage();
    serverUsagePoll = setInterval(() => {
        getServerUsage();
    }, 10000);
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
        broadcast(serverEvent, `${moment().format('HH:mm:ss.SSS')} : ${data}`);
    });

    updateStateAndBroadCast('started');
    startPollingServerUsage();
}

function startServer(event, config) {
    updateStateAndBroadCast('loading');

    if (childProc) {
        updateStateAndBroadCast('error');
        console.log('Cannot start process it is already started');
        return {
            success: false
        };
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    console.log(`Starting robit server in location ${dir}`);
    if (serverContents) {
        spawnLocalServer(dir, config);
        return { success: true };   
    }

    console.log('Server contents are unknown fetching those now');
    request.get('https://raw.githubusercontent.com/JeffreyRiggle/somerobit/master/dist/bundle.js', (err, response, body) => {
        serverContents = body;
        spawnLocalServer(dir, config);
    });

    return {
        success: true
    }
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

    return {
        success: true
    };
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