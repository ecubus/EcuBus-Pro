const { test, describe } = require('node:test')
const assert = require('node:assert')
const { test: ____ecubus_pro_test___ } = require('node:test')
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let cnt = 0

test('synchronous passing test #0', (t) => {
    // This test passes because it does not throw an exception.
    console.log('aaa passing test', cnt++, global.cnt)
    assert.strictEqual(1, 1);
});

test('asynchronous passing test #1', async (t) => {
    console.log(' xx passing test', cnt++)
    await delay(2000);
    console.log('xxx passing test 2', cnt++)
    await delay(2000);
    assert.strictEqual(1, 1);
});



test('asynchronous passing test #2', async (t) => {
    console.log(' mm passing test', cnt++)
    await delay(1100);
    console.log('mm passing test 2', cnt++)
    await delay(1100);
    assert.strictEqual(1, 1);
});


function a(){
    ____ecubus_pro_test___('____ecubus_pro_test___',()=>{
      
      })
      
}
a()