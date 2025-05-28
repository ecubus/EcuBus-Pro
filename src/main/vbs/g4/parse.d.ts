/**
 * Parses IDL grammar content using ANTLR4
 * @param content - The IDL content to parse
 * @returns The parsed result from the grammar listener
 */
declare function parse(content: string): any

export default parse
