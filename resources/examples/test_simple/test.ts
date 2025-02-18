import {describe,test,assert} from 'ECB'


describe('Test Suite',() => {
    describe('Test subSuite',() => {
        test('Test xxx', () => {
            assert(true)
        })
    })
    test('Test 1', () => {
        assert(true)
    })
    test.todo('Test 2', async () => {
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