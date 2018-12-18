import fs from 'fs';
import {spawn} from 'child_process';

const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
const dir = appData + '/robitserver';
const serverContents = fs.readFileSync(__dirname + '/../../builtServer/bundle.js');

let childProc;

const startServer = (config) => {
    if (childProc) {
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
}

const stopServer = () => {
    if (!childProc) {
        console.log('Cannot kill process it is not running');
        return;
    }

    childProc.kill();
    childProc = null;
}

export {
    startServer,
    stopServer
}