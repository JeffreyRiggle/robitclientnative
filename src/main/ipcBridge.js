import {ipcMain} from 'electron';

const start = () => {
    ipcMain.on('healthcheck', (event) => {
        event.sender.send('heartbeat');
    });

    ipcMain.on('startserver', (event) => {
        event.sender.send('serverstate', 'loading');
        
        setTimeout(() => {
            event.sender.send('serverstate', 'started');
        }, 5000)
    })
}

export default start