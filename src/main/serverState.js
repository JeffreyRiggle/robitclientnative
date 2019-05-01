import { broadcast } from '@jeffriggle/ipc-bridge-server';
import events from './events';

let state = 'stopped';

const updateStateAndBroadCast = (newstate) => {
    state = newstate;
    broadcast(events.serverState, state);
}

const getServerState = () => {
    return state;
}

export {
    updateStateAndBroadCast,
    getServerState
}