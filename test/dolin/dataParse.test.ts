import { describe, test, expect, beforeAll } from 'vitest'
import { parseLinData, initDataBase } from 'src/renderer/src/worker/dataParse'
import parse from 'src/renderer/src/database/ldfParse'
import fs from 'fs'
import path from 'path'
import { LinChecksumType, LinDirection, LinMsg } from 'src/main/share/lin'


describe('LIN Signal Parse', () => {
    beforeAll(() => {
        // Load and initialize test database
        const ldfStr = fs.readFileSync(path.join(__dirname, '2.2.ldf'), 'utf-8')
        const ldf = parse(ldfStr)
        ldf.name = 'test.ldf'
        initDataBase({
            lin: {
                'test.ldf': ldf
            },
          
        })
    })

    test('parse scalar signal - Motor1Temp', () => {
        const msg: LinMsg = {
            name: 'Motor1State_Cycl',
            frameId: 51, // Motor1State_Cycl frame
            data: Buffer.from([0x28, 0x00, 0x00, 0x00, 0x00, 0x00]), // Temperature value 40
            direction: LinDirection.RECV,
            database: 'test.ldf',
            checksumType: LinChecksumType.CLASSIC,
        }
        
        const result = parseLinData([msg])
     
        expect(result['lin.test.ldf.signals.Motor1Temp']).toBeDefined()
        expect(result['lin.test.ldf.signals.Motor1Temp'][0].val).toBe(0x28)
    })

    // test('parse byte array signal - Motor1Position', () => {
    //     const msg: LinMsg = {
    //         frameId: 51, // Motor1State_Cycl frame
    //         data: Buffer.from([0x00, 0x12, 0x34, 0x56, 0x78, 0x00]),
    //         direction: LinDirection.RECV,
    //         database: 'test.ldf',
    //         checksumType: LinChecksumType.CLASSIC
    //     }

    //     const result = parseLinData([msg])
    //     expect(result['lin.test.ldf.signals.Motor1Position']).toBeDefined()
    //     expect(result['lin.test.ldf.signals.Motor1Position'][0].val).toBe(0x78563412)
    // })

    // test('parse bit signal - Motor1LinError', () => {
    //     const msg: LinMsg = {
    //         frameId: 51, // Motor1State_Cycl frame
    //         data: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x00]), // Error bit set
    //         direction: LinDirection.RECV,
    //         database: 'test.ldf',
    //         checksumType: LinChecksumType.CLASSIC
    //     }

    //     const result = parseLinData([msg])
    //     expect(result['lin.test.ldf.signals.Motor1LinError']).toBeDefined()
    //     expect(result['lin.test.ldf.signals.Motor1LinError'][0].val).toBe(1)
    // })

    // test('parse multiple signals from one frame', () => {
    //     const msg: LinMsg = {
    //         frameId: 51, // Motor1State_Cycl frame
    //         data: Buffer.from([0x28, 0x12, 0x34, 0x56, 0x78, 0x01]),
    //         direction: LinDirection.RECV,
    //         database: 'test.ldf',
    //         checksumType: LinChecksumType.CLASSIC
    //     }

    //     const result = parseLinData([msg])
        
    //     // Check temperature
    //     expect(result['lin.test.ldf.signals.Motor1Temp'][0].val).toBe(0x28)
        
    //     // Check position
    //     expect(result['lin.test.ldf.signals.Motor1Position'][0].val).toBe(0x78563412)
        
    //     // Check error bit
    //     expect(result['lin.test.ldf.signals.Motor1LinError'][0].val).toBe(1)
    // })

    // test('parse signals with non-byte-aligned offsets', () => {
    //     // Test using MotorControl frame which has signals with various bit offsets
    //     const msg: LinMsg = {
    //         frameId: 45, // MotorControl frame
    //         data: Buffer.from([0x05, 0x20]), // Direction=1, Speed=2, Selection=2
    //         direction: LinDirection.RECV,
    //         database: 'test.ldf',
    //         checksumType: LinChecksumType.CLASSIC
    //     }

    //     const result = parseLinData([msg])
        
    //     expect(result['lin.test.ldf.signals.MotorDirection'][0].val).toBe(1)
    //     expect(result['lin.test.ldf.signals.MotorSpeed'][0].val).toBe(2)
    //     expect(result['lin.test.ldf.signals.MotorSelection'][0].val).toBe(2)
    // })
}) 