import { exec } from 'child_process';
import request from 'request';
import { updateStateAndBroadCast } from '../serverState';
import { sendServerHealth } from '../helpers/notifications';

let pollingInterval, serverUsagePoll, upTime;

function waitUp(timeout) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        pollingInterval = setInterval(() => {
            request.get('http://localhost:8080/robit/state', (err, response, body) => {
                let json = JSON.parse(body);
                
                if (json.state === 'Stopped') {
                    clearInterval(pollingInterval);
                    resolve();
                } else if (timeout < Date.now() - startTime) {
                    clearInterval(pollingInterval);
                    reject('timed out waiting for docker server');
                }
            })
        }, 500);
    });
}

function startRunningDockerServer(config) {
    return new Promise((resolve, reject) => {
        exec('docker pull jeffriggle/robit && docker run -p 8080:8080 -d jeffriggle/robit', (err, stdout, stderr) => {
            if (err) {
                console.log('Failed to start docker');
                reject(err)
                return;
            }
    
            waitUp(5000).then(() => {
                request.post('http://localhost:8080/robit/start', {
                    json: config
                }, (err, response , body) => {
                    if (err) {
                        console.log(`Failed to set robit config. error ${err}, response: ${JSON.stringify(response)}. body: ${JSON.stringify(body)}`);
                        reject(err);
                        return;
                    }

                    resolve();
                });
            }).catch(err => {
                reject(err);
            });
        });
    });
}

function notifyServerHealth() {
    sendServerHealth(null, null, upTime);
}

function startPollingServerUsage() {
    upTime = Date.now();
    notifyServerHealth();

    serverUsagePoll = setInterval(() => {
        notifyServerHealth();
    }, 10000);
}

const startDockerServer = (config) => {
    startRunningDockerServer(config).then(() => {
        startPollingServerUsage();
        updateStateAndBroadCast('started');
    });

    return {
        success: true
    }
}

const stopDockerServer = () => {
    request.post('http://localhost:8080/robit/stop');

    clearInterval(serverUsagePoll);
    updateStateAndBroadCast('stopped');
    sendServerHealth();

    return {
        success: true
    }
}

const dockerEnabled = () => {
    return new Promise((resolve, reject) => {
        exec('docker --version', (err, stdout, stderr) => {
            resolve(!err && !stderr);
        });
    });
}

export {
    startDockerServer,
    stopDockerServer,
    dockerEnabled
}