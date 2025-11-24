const chrono = require('chrono-node');

const inputs = [
    "12월 25일",
    "12월 25일 파티",
    "내일",
    "오후 2시 미팅",
    "12:00 점심"
];

inputs.forEach(text => {
    const results = chrono.ko.parse(text);
    if (results.length > 0) {
        const result = results[0];
        const date = result.start.date();
        const isCertainHour = result.start.isCertain('hour');
        console.log(`Input: "${text}"`);
        console.log(`  Date: ${date.toLocaleString()}`);
        console.log(`  Hour: ${date.getHours()}:${date.getMinutes()}`);
        console.log(`  Certain Hour: ${isCertainHour}`);
    } else {
        console.log(`Input: "${text}" - No result`);
    }
});
