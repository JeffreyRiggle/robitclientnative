import {ipcMain} from 'electron';

let events = new Map();
let subscriptions = new Map();

const start = () => {
    ipcMain.on('healthcheck', (event) => {
        event.sender.send('heartbeat');
    });

    ipcMain.on('subscribe', (event, id) => {
        console.log(`Got subscription request for ${id}`);

        if (!subscriptions.get(id)) {
            subscriptions.set(id, [event.sender]);
        }
        else {
            subscriptions.get(id).push(event.sender);
        }

        let evt = events.get(id);
        if (evt) {
            evt(event.sender);
        }
    });

    ipcMain.on('unsubscribe', (event, id) => {
        console.log(`Got unsubsciption request for ${id}`);

        if (!subscriptions.get(id)) {
            return;
        }

        let ind = subscriptions.get(id).indexOf(event.sender);
        if (ind !== -1) {
            subscriptions.get(id).splice(ind, 1);
        }
    });

    ipcMain.on('request', (event, message) => {
        let evt = events.get(message.id);

        if (!evt) {
            event.sender.send('error', {message: `Event ${message.id} does not exist`});
            return;
        }

        evt(event, message.data);
    })
}

const registerEvent = (eventId, func) => {
    events.set(eventId, func);
}

const unRegisterEvent = (eventId) => {
    events.delete(eventId);
}

const broadcast = (eventId, message) => {
    let listeners = subscriptions.get(eventId);

    if (!listeners) {
        console.log(`No registered events for ${eventId}`);
        return;
    }

    listeners.forEach(listener => {
        console.log(`Sending event ${eventId} with data ${message}`);
        listener.send(eventId, message);
    });
}

export {
    start,
    registerEvent,
    unRegisterEvent,
    broadcast
}