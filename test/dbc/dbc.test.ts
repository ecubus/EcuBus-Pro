import { beforeAll, describe, expect, test } from 'vitest';
import parse from 'src/renderer/src/database/dbcParse';
import fs from 'fs';
import path from 'path';

describe('DBC Parser Tests', () => {
    let dbcContentModel3: string;
    let dbcContentHyundaiKia: string;
    let dbcContentVwSkodaAudi: string;

    beforeAll(() => {
        dbcContentModel3 = fs.readFileSync(path.join(__dirname, 'Model3CAN.dbc'), 'utf-8');
        dbcContentHyundaiKia = fs.readFileSync(path.join(__dirname, 'can1-hyundai-kia-uds-v2.4.dbc'), 'utf-8');
        dbcContentVwSkodaAudi = fs.readFileSync(path.join(__dirname, 'can1-vw-skoda-audi-uds-v2.5.dbc'), 'utf-8');
    });

    test('dbc model3', () => {
        const result = parse(dbcContentModel3);
        // Add assertions to verify the parsed values for Model3CAN.dbc
        expect(result).toBeDefined();
        // Add more specific assertions based on the expected structure of Model3CAN.dbc
    });

    test('dbc can1-hyundai-kia-uds-v2.4', () => {
        const result = parse(dbcContentHyundaiKia);
        // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
        expect(result).toBeDefined();
        // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
    });

    test('dbc can1-vw-skoda-audi-uds-v2.5', () => {
        const result = parse(dbcContentVwSkodaAudi);
        // Add assertions to verify the parsed values for can1-vw-skoda-audi-uds-v2.5.dbc
        expect(result).toBeDefined();
        expect(result.version).toBe("");
        expect(result.nodes).toEqual({});
        expect(result.messages[2550005883].name).toBe("Battery");
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].multiplexerRange).toEqual({
            name: "R",
            range: [652]
        });
        expect(result.messages[2550005883].signals["R"].multiplexerRange).toEqual({
            name: "S",
            range: [98]
        });
        expect(result.messages[2550005945].name).toBe("VoltageCurrent");
        expect(result.messages[2550005945].signals["Voltage"].multiplexerRange).toEqual({
            name: "R",
            range: [18013]
        });
        expect(result.messages[2550005878].name).toBe("Odometer");
        expect(result.messages[2550005878].signals["Odometer"].multiplexerRange).toEqual({
            name: "R",
            range: [10586]
        });
        expect(result.messages[1968].name).toBe("Temperature");
        expect(result.messages[1968].signals["OutdoorTemp"].multiplexerRange).toEqual({
            name: "R",
            range: [9737]
        });

        // Add assertions for signal values
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].factor).toBe(0.4);
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].offset).toBe(0);
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].minimum).toBe(0);
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].maximum).toBe(100);
        expect(result.messages[2550005883].signals["StateOfChargeBMS"].unit).toBe("%");

        expect(result.messages[2550005945].signals["Voltage"].factor).toBe(0.001953125);
        expect(result.messages[2550005945].signals["Voltage"].offset).toBe(0);
        expect(result.messages[2550005945].signals["Voltage"].minimum).toBe(0);
        expect(result.messages[2550005945].signals["Voltage"].maximum).toBe(0);
        expect(result.messages[2550005945].signals["Voltage"].unit).toBe("V");

        expect(result.messages[2550005878].signals["Odometer"].factor).toBe(1);
        expect(result.messages[2550005878].signals["Odometer"].offset).toBe(0);
        expect(result.messages[2550005878].signals["Odometer"].minimum).toBe(0);
        expect(result.messages[2550005878].signals["Odometer"].maximum).toBe(0);
        expect(result.messages[2550005878].signals["Odometer"].unit).toBe("km");

        expect(result.messages[1968].signals["OutdoorTemp"].factor).toBe(0.5);
        expect(result.messages[1968].signals["OutdoorTemp"].offset).toBe(-50);
        expect(result.messages[1968].signals["OutdoorTemp"].minimum).toBe(0);
        expect(result.messages[1968].signals["OutdoorTemp"].maximum).toBe(0);
        expect(result.messages[1968].signals["OutdoorTemp"].unit).toBe("degC");


        expect(result.messages[1968].attributes['TransportProtocolType'].currentValue).toBe("ISOTP");

        // Add assertions for BA_DEF_ and BA_DEF_DEF_
        expect(result.attributes["SignalIgnore"]).toBeDefined();
        expect(result.attributes["SignalIgnore"].type).toBe("INT");
        expect(result.attributes["SignalIgnore"].min).toBe(0);
        expect(result.attributes["SignalIgnore"].max).toBe(1);
        expect(result.attributes["SignalIgnore"].defaultValue).toBe(0);

        expect(result.attributes["VFrameFormat"]).toBeDefined();
        expect(result.attributes["VFrameFormat"].type).toBe("ENUM");
        expect(result.attributes["VFrameFormat"].enumList).toEqual([
            "StandardCAN", "ExtendedCAN", "StandardCAN_FD", "ExtendedCAN_FD", "J1939PG"
        ]);
        expect(result.attributes["VFrameFormat"].defaultValue).toBe("");

        expect(result.attributes["MessageIgnore"]).toBeDefined();
        expect(result.attributes["MessageIgnore"].type).toBe("INT");
        expect(result.attributes["MessageIgnore"].min).toBe(0);
        expect(result.attributes["MessageIgnore"].max).toBe(1);
        expect(result.attributes["MessageIgnore"].defaultValue).toBe(0);

        expect(result.attributes["TransportProtocolType"]).toBeDefined();
        expect(result.attributes["TransportProtocolType"].type).toBe("STRING");
        expect(result.attributes["TransportProtocolType"].defaultValue).toBe("");

        expect(result.attributes["BusType"]).toBeDefined();
        expect(result.attributes["BusType"].type).toBe("STRING");
        expect(result.attributes["BusType"].currentValue).toBe("CAN");
  

        expect(result.attributes["ProtocolType"]).toBeDefined();
        expect(result.attributes["ProtocolType"].type).toBe("STRING");
        expect(result.attributes["ProtocolType"].currentValue).toBe("OBD");

        expect(result.attributes["DatabaseCompiler"]).toBeDefined();
        expect(result.attributes["DatabaseCompiler"].type).toBe("STRING");
        expect(result.attributes["DatabaseCompiler"].defaultValue).toBe("CSS Electronics (wwww.csselectronics.com)");
    });
});


