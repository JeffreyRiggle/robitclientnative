import fs from 'fs';
import { exec } from 'child_process';

const linuxMemoryReg = /VmSize:\s*([\d\skBmg]*)/;

function getLinuxHealth(proc) {
    return new Promise((resolve, reject) => {
        fs.readFile(`/proc/${proc.pid}/status`, (err, data) => {
            let memory = linuxMemoryReg.exec(data.toString())[1];
            
            exec(`ps -p ${proc.pid} -o %cpu`, (err, stdout) => {
                let cpu = stdout.replace('%CPU', '') + '%';
                resolve({
                    memory: memory,
                    cpu: cpu
                });
            });
        });
    });
}

function getWindowsHealth(proc) {
    return new Promise((resolve, reject) => {
        exec(`tasklist /v /fi "PID eq ${proc.pid}" /fo csv`, (err, stdout, stderr) => {
            if (err) {
                console.log(`Got error ${err} when attempting to read task list`);
                reject(err);
                return;
            }

            let info = stdout.toString().split('\n')[1];
            let [imageName, procId, sessionName, sessionNum, mem, status, userName, cpu, title] = info.split('","');
            
            resolve({
                memory: mem,
                cpu: cpu
            });
        });
    });
}

const getProcessUsage = (proc) => {
    return new Promise((resolve, reject) => {
        if (process.platform === 'linux') {
            getLinuxHealth(proc).then((data) => {
                resolve(data);
            }).catch(err => reject(err));
            return;
        }
        if (process.platform === 'win32') {
            getWindowsHealth(proc).then((data) => {
                resolve(data);
            }).catch(err => reject(err));
            return;
        }

        reject(`Health check is not supported on ${process.platform}`);
    });
};

export {
    getProcessUsage
}