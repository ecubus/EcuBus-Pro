import {describe,test,assert} from 'ECB'


describe('Test Suite',() => {
    test('Test 1', () => {
        assert(true)
    })
    test('Test 2', async () => {
        assert(false)
    })
})