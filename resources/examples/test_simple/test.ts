import {describe,test,assert,CanMessage} from 'ECB'



const TestWaitForMessage=async (id:number|true,timeout:number=1000)=>{
    return new Promise<CanMessage>((resolve,reject)=>{
        const  timer=setTimeout(()=>{
            reject(new Error('timeout'))
        },timeout)
        Util.OnCanOnce(id,(msg)=>{
            clearTimeout(timer)
            resolve(msg)
        })  
    })
}

const delay=async (ms:number)=>{
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve(true)
        },ms)
    })
}

describe('Test Suite',() => {
    describe('Test subSuite',() => {
        test('Test xxx', async () => {
            await delay(3000)
            assert(true)
        })
    })
    test('Test 1', async () => {
        await TestWaitForMessage(0x1,1000)
        assert(true)
    })
    test('Test 2', async () => {
        await delay(3000)
        assert(false)
    })
    test.skip('Test 3', async () => {
        assert(true)
    })
})
describe('Test Suite 2',() => {
    test('Test 4', () => {
        assert(true)
    })
})