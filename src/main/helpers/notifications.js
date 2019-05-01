import { broadcast } from '@jeffriggle/ipc-bridge-server';
import formatUpTime from './formatUpTime';

const sendServerHealth = (memory, cpu, upTime) => {
    let liveTime = 'N/A';

    if (upTime) {
        liveTime = formatUpTime((Date.now() - upTime));
    }

    broadcast('serverhealth', {
        memory: memory ? memory : 'N/A',
        cpu: cpu ? cpu : 'N/A',
        upTime: liveTime
    });
};

export {
    sendServerHealth
}