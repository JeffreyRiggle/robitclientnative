import { registerEvent } from '@jeffriggle/ipc-bridge-server';
import { startDockerServer, stopDockerServer, dockerEnabled } from './servers/dockerServer';
import { updateStateAndBroadCast, getServerState } from './serverState';
import { startLocalServer, stopLocalServer} from './servers/localServer';
import events from './events';

let runningServerType;
let hasDocker = false;

dockerEnabled().then((enabled) => {
    hasDocker = enabled;
});

function startServer(event, data) {
    console.log(`Got start server event with type ${data.type}`);
    updateStateAndBroadCast('loading');

    if (data.type === 'Local') {
        runningServerType = 'Local';
        return startLocalServer(data.config);
    } else if (data.type === 'Docker') {
        runningServerType = 'Docker';
        return startDockerServer(data.config);
    } else {
        return { success: false };
    }
}

function stopServer() {
    if (!runningServerType) {
        updateStateAndBroadCast('error');
        console.log('No server type is defined');
        return;
    }

    if (runningServerType === 'Local') {
        return stopLocalServer();
    }

    if (runningServerType === 'Docker') {
        return stopDockerServer();
    }

    console.log(`Unknown server type ${runningServerType}`);
    return {
        success: false
    }
}

function handleServerState(event) {
    let state = getServerState();
    console.log(`Handling server state request current state is ${state}`);
    event.send(events.serverState, state);
}

function getServerTypes() {
    let retVal = ['Local'];
    if (hasDocker) {
        retVal.push('Docker');
    }

    console.log('Got server types request');
    return retVal;
}

registerEvent(events.startServer, startServer);
registerEvent(events.stopServer, stopServer);
registerEvent(events.serverData, handleServerState);
registerEvent(events.serverTypes, getServerTypes);