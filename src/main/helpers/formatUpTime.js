const dayInterval = 1 * 24 * 60 * 60 * 1000;
const hourInterval = 1 * 60 * 60 * 1000;
const minuteInterval = 1 * 60 * 1000;
const secondInterval = 1000;

export default function formatUpTime(ms) {
    let days = 0, hours = 0, minutes = 0, seconds = 0;

    while(ms >= dayInterval) {
        days++;
        ms -= dayInterval;
    }

    while(ms >= hourInterval) {
        hours++;
        ms -= hourInterval
    }

    while(ms >= minuteInterval) {
        minutes++;
        ms -= minuteInterval
    }

    while(ms >= secondInterval) {
        seconds++;
        ms -= secondInterval;
    }

    return `${days}:${hours <= 9 ? '0' : ''}${hours}:${minutes <= 9 ? '0' : ''}${minutes}:${seconds <= 9 ? '0' : ''}${seconds}:${ms}`
}