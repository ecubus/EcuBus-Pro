import { beforeAll, describe, expect, test } from 'vitest';
import parse from 'src/renderer/src/database/dbcParse';
import fs from 'fs';
import path from 'path';





describe('DBC Parser Tests', () => {
    

  
    test('dbc model3', () => {
        const dbcContent = fs.readFileSync(path.join(__dirname, 'Model3CAN.dbc'), 'utf-8');
        parse(dbcContent);
    });
    // test('dbc can1-hyundai-kia-uds-v2.4', () => {
    //     const dbcContent = fs.readFileSync(path.join(__dirname, 'can1-hyundai-kia-uds-v2.4.dbc'), 'utf-8');
    //     parse(dbcContent);
    // });
    // test('dbc can1-vw-skoda-audi-uds-v2.5', () => {
    //     const dbcContent = fs.readFileSync(path.join(__dirname, 'can1-vw-skoda-audi-uds-v2.5.dbc'), 'utf-8');
    //     parse(dbcContent);
    // });



    
});
