import {  JsonLexer, parser } from "./dbc/parse";
import { DBC, DBCVisitor, Message } from "./dbc/dbcVisitor";
import { CAN_ID_TYPE } from "src/main/share/can";

// 添加一个函数来创建行号映射
function createLineMapping(originalText: string, processedText: string): number[] {
    const originalLines = originalText.split('\n');
    const processedLines = processedText.split('\n');
    const mapping: number[] = [];
    let originalLineNum = 0;
    
    for (let processedLineNum = 0; processedLineNum < processedLines.length; processedLineNum++) {
        while (originalLineNum < originalLines.length) {
            const originalLine = originalLines[originalLineNum].trim();
            const processedLine = processedLines[processedLineNum].trim();
            
            if (originalLine === processedLine || 
                (originalLine.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/, '').trim() === processedLine)) {
                mapping[processedLineNum] = originalLineNum;
                originalLineNum++;
                break;
            }
            originalLineNum++;
        }
    }
    return mapping;
}

function formatLexerError(error: any, text: string, originalText: string, lineMapping: number[]): string {
    const lines = text.split('\n');
    const originalLines = originalText.split('\n');
    const lineNumber = error.line - 1;
    const originalLineNumber = lineMapping[lineNumber];
    
    // Get context from original text
    const contextStart = Math.max(0, originalLineNumber - 3);
    const contextEnd = Math.min(originalLines.length, originalLineNumber + 4);
    const contextLines = originalLines.slice(contextStart, contextEnd);
    
    const context = contextLines.map((line, idx) => {
        const currentLineNumber = contextStart + idx + 1;
        const linePrefix = currentLineNumber === (originalLineNumber + 1) ? '>' : ' ';
        const lineText = `${linePrefix} ${currentLineNumber.toString().padStart(4)}: ${line}`;
        // Add pointer right after the error line
        if (currentLineNumber === (originalLineNumber + 1)) {
            return `${lineText}\n     ${' '.repeat(error.column)}^`;
        }
        return lineText;
    }).join('\n');
    
    const message = `Lexer error at line ${originalLineNumber + 1}, column ${error.column}:
Context:
${context}
Unexpected character: "${error.message.split("'")[1]}"`;
    return message;
}

function formatParserError(error: any, text: string, originalText: string, lineMapping: number[]): string {
    const lines = text.split('\n');
    const originalLines = originalText.split('\n');
    let lineNumber = error.token.startLine - 1;
    if (isNaN(lineNumber)) {
        // 如果行号是NaN，尝试从token的位置计算行号
        const textUpToToken = text.slice(0, error.token.startOffset);
        lineNumber = (textUpToToken.match(/\n/g) || []).length;
    }
    
    const originalLineNumber = lineMapping[lineNumber] || lineNumber;
    
    // 获取错误上下文
    const contextStart = Math.max(0, originalLineNumber - 3);
    const contextEnd = Math.min(originalLines.length, originalLineNumber + 4);
    const contextLines = originalLines.slice(contextStart, contextEnd);
    
    const context = contextLines.map((line, idx) => {
        const currentLineNumber = contextStart + idx + 1;
        const linePrefix = currentLineNumber === (originalLineNumber + 1) ? '>' : ' ';
        const lineText = `${linePrefix} ${currentLineNumber.toString().padStart(4)}: ${line}`;
        // Add pointer right after the error line
        if (currentLineNumber === (originalLineNumber + 1)) {
            return `${lineText}\n     ${' '.repeat(error.token.startColumn || 0)}^`;
        }
        return lineText;
    }).join('\n');
    
    const message = `Parser error at line ${originalLineNumber + 1}, column ${error.token.startColumn || 0}:
Context:
${context}
${error.message}
Expected one of: ${(error.expectedTokens || []).join(', ')}`;
    
    return message;
}



export function isCanFd(message:Message):boolean{
    let val=false
    if(message.attributes["VFrameFormat"]&&message.attributes["VFrameFormat"].enumList&&message.attributes["VFrameFormat"].currentValue!=undefined){
        let vval=message.attributes["VFrameFormat"].enumList[message.attributes["VFrameFormat"].currentValue]
        if(vval){
            val=vval.toLowerCase().includes('fd')
        }
    }
    return val
}



export function getMessageData(message: Message): Buffer {
    const data = Buffer.alloc(message.length)
    
    // Process each signal
    Object.values(message.signals).forEach(signal => {
        if (signal.value === undefined) return
        
        let rawValue = signal.value
        const maxValue = Math.pow(2, signal.length) - 1
        
        // Ensure value doesn't exceed the signal's bit length
        rawValue = Math.min(rawValue, maxValue)
        
        if (signal.isLittleEndian) {
            // Intel format (Little Endian)
            let startByte = Math.floor(signal.startBit / 8)
            let startBitInByte = signal.startBit % 8
            let remainingBits = signal.length
            let valueIndex = 0
            
            while (remainingBits > 0) {
                if (startByte >= data.length) break
                
                // Calculate how many bits we can write in this byte
                const bitsInThisByte = Math.min(8 - startBitInByte, remainingBits)
                
                // Extract the bits we want to write
                const mask = (1 << bitsInThisByte) - 1
                const value = (rawValue >> valueIndex) & mask
                
                // Write the bits to the byte
                data[startByte] &= ~(mask << startBitInByte) // Clear the bits
                data[startByte] |= (value << startBitInByte) // Set the new bits
                
                // Move to next byte
                remainingBits -= bitsInThisByte
                valueIndex += bitsInThisByte
                startByte += 1
                startBitInByte = 0
            }
        } else {
            // Motorola format (Big Endian)
            let startByte = Math.floor(signal.startBit / 8)
            let startBitInByte = 7 - (signal.startBit % 8)
            let remainingBits = signal.length
            let valueIndex = signal.length - 1
            
            while (remainingBits > 0) {
                if (startByte >= data.length) break
                
                // Calculate how many bits we can write in this byte
                const bitsInThisByte = Math.min(startBitInByte + 1, remainingBits)
                
                // Extract the bits we want to write
                const mask = (1 << bitsInThisByte) - 1
                const value = (rawValue >> (signal.length - remainingBits)) & mask
                
                // Calculate position in byte
                const position = startBitInByte - bitsInThisByte + 1
                
                // Write the bits to the byte
                data[startByte] &= ~(mask << position) // Clear the bits
                data[startByte] |= (value << position) // Set the new bits
                
                // Move to next byte
                remainingBits -= bitsInThisByte
                startByte -= 1
                startBitInByte = 7
            }
        }
    })
    
    return data
}
// Update the parse function with improved error handling
export default function parse(text: string): DBC {
    const originalText = text;
    // Remove comments and empty lines
    const cleanText = text;
    
    const lineMapping = createLineMapping(originalText, cleanText);
    const lexingResult = JsonLexer.tokenize(cleanText);
 
    if (lexingResult.errors.length > 0) {
        // const formattedErrors = lexingResult.errors.map((err:any) => 
        //     formatLexerError(err, cleanText, originalText, lineMapping)
        // );
        const formattedErrors=formatLexerError(lexingResult.errors[0], cleanText, originalText, lineMapping)
        throw new Error(`Lexing errors:\n${formattedErrors}`);
    }

    parser.input = lexingResult.tokens;

    try {
        const cst = parser.dbcFile();
        if (parser.errors.length > 0) {
            // const formattedErrors = parser.errors.map(err => 
            //     formatParserError(err, cleanText, originalText, lineMapping)
            // );
            const formattedErrors=formatParserError(parser.errors[0], cleanText, originalText, lineMapping)
            throw new Error(`Parsing errors:\n${formattedErrors}`);
        }
        const visitor = new DBCVisitor();
        return visitor.visit(cst);
    } catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        throw new Error(`Unexpected error during parsing: ${err}`);
    }
}
