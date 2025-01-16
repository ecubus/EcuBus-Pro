import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { generateCstDts } from "@chevrotain/cst-dts-gen";
import { productions } from "./parse.js";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dtsString = generateCstDts(productions);
const dtsPath = resolve(__dirname, "dbc_cst.d.ts");
writeFileSync(dtsPath, dtsString);