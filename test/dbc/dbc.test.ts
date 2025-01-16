import { beforeAll, describe, expect, test } from 'vitest';
import parse from 'src/renderer/src/database/dbcParse';
import fs from 'fs';
import path from 'path';
import { DBC } from 'src/renderer/src/database/dbc/parse';

describe('DBC Parser Tests', () => {
    let dbc: DBC;

    beforeAll(() => {
        const dbcContent = fs.readFileSync(path.join(__dirname, 'can1-hyundai-kia-uds-v2.4.dbc'), 'utf-8');
        dbc = parse(dbcContent);
    });

    test('should parse basic DBC structure', () => {
        expect(dbc).toBeDefined();
        expect(dbc.nodes).toBeDefined();
        expect(dbc.messages).toBeDefined();
    });

    test('should parse Battery message correctly', () => {
        const batteryMsg = dbc.messages[2028];
        expect(batteryMsg).toBeDefined();
        expect(batteryMsg.name).toBe('Battery');
        expect(batteryMsg.id).toBe(2028);
        expect(batteryMsg.length).toBe(61);
    });

    test('should parse Battery signals correctly', () => {
        const batteryMsg = dbc.messages[2028];
        
        // Test StateOfChargeBMS signal
        const socSignal = batteryMsg.signals['StateOfChargeBMS'];
        expect(socSignal).toBeDefined();
        expect(socSignal.startBit).toBe(63);
        expect(socSignal.length).toBe(8);
        expect(socSignal.factor).toBe(0.5);
        expect(socSignal.offset).toBe(3);
        expect(socSignal.minimum).toBe(0);
        expect(socSignal.maximum).toBe(100);
        expect(socSignal.unit).toBe('%');
        
        // Test BatteryDCVoltage signal
        const voltageSignal = batteryMsg.signals['BatteryDCVoltage'];
        expect(voltageSignal).toBeDefined();
        expect(voltageSignal.startBit).toBe(127);
        expect(voltageSignal.length).toBe(16);
        expect(voltageSignal.factor).toBe(0.1);
        expect(voltageSignal.offset).toBe(0);
        expect(voltageSignal.unit).toBe('V');
    });

    test('should parse TempAndSpeed message correctly', () => {
        const tempSpeedMsg = dbc.messages[1979];
        expect(tempSpeedMsg).toBeDefined();
        expect(tempSpeedMsg.name).toBe('TempAndSpeed');
        expect(tempSpeedMsg.length).toBe(53);

        // Test IndoorTemperature signal
        const indoorTempSignal = tempSpeedMsg.signals['IndoorTemperature'];
        expect(indoorTempSignal).toBeDefined();
        expect(indoorTempSignal.startBit).toBe(71);
        expect(indoorTempSignal.length).toBe(8);
        expect(indoorTempSignal.factor).toBe(0.5);
        expect(indoorTempSignal.offset).toBe(-40);
        expect(indoorTempSignal.minimum).toBe(-50);
        expect(indoorTempSignal.maximum).toBe(50);
        expect(indoorTempSignal.unit).toBe('degC');
    });

    test('should parse Tire message correctly', () => {
        const tireMsg = dbc.messages[1960];
        expect(tireMsg).toBeDefined();
        expect(tireMsg.name).toBe('Tire');
        expect(tireMsg.length).toBe(63);

        // Test TirePressureFrontLeft signal
        const tirePressureSignal = tireMsg.signals['TirePressureFrontLeft'];
        expect(tirePressureSignal).toBeDefined();
        expect(tirePressureSignal.startBit).toBe(63);
        expect(tirePressureSignal.length).toBe(8);
        expect(tirePressureSignal.factor).toBe(0.2);
        expect(tirePressureSignal.offset).toBe(0);
        expect(tirePressureSignal.minimum).toBe(0);
        expect(tirePressureSignal.maximum).toBe(120);
        expect(tirePressureSignal.unit).toBe('psi');
    });

    test('should parse attributes correctly', () => {
        expect(dbc.attributes).toBeDefined();
        // Check for known attributes from the file
        expect(dbc.attributes['SignalIgnore']).toBeDefined();
        expect(dbc.attributes['VFrameFormat']).toBeDefined();
        expect(dbc.attributes['BusType']).toBeDefined();
    });
});
