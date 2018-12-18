import {ipcMain} from 'electron';
import {startServer, stopServer} from './serverManager';

const start = () => {
    ipcMain.on('healthcheck', (event) => {
        event.sender.send('heartbeat');
    });

    ipcMain.on('startserver', (event, config) => {
        event.sender.send('serverstate', 'loading');

        setTimeout(() => {
            startServer(config);
            event.sender.send('serverstate', 'started');
        }, 1);
    });

    ipcMain.on('stopserver', (event) => {
        setTimeout(() => {
            stopServer();
            event.sender.send('serverstate', 'stopped');
        }, 1);
    });
}

export default start