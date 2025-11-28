declare module '*.node' {
  const _: any
  export default _
}

declare module '*.html?raw' {
  const content: string
  export default content
}
