import {describe,test,assert} from 'ECB'


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
    test('Test 1', () => {
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