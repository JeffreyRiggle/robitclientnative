import {ipcMain} from 'electron';

const start = () => {
    ipcMain.on('healthcheck', (event) => {
        event.sender.send('heartbeat');
    });
}

export default start