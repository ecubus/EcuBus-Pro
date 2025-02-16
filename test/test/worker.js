const {
    Worker,
    isMainThread,
    setEnvironmentData,
    getEnvironmentData,
} = require('node:worker_threads');
const path = require('node:path');
const worker = new Worker(path.resolve(__dirname, 'test.js'), {
    execArgv: [
        '--test-reporter=file://D:/code/ecubus-pro/resources/lib/js/report.js',
        '--test-only'
    ]
});
worker.on('message', (message) => {
    console.log('message', message.payload)
});
worker.on('error', (error) => {
    console.error('error', error)
});

