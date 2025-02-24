export default function errorParse(error: Error | string) {
  //Error: Error invoking remote method 'ipc-fs-writeFile': Error: ENOENT: no such file or directory, open 'D:\code\ecubus-pro\resources\examples\test_simple\report\Test Config 01.html' to no such file or directory, open 'D:\code\ecubus-pro\resources\examples\test_simple\report\Test Config 01.html
  const msg = error.toString()
  const match = msg.match(/Error: Error invoking remote method '([^']+)': (.*)/)
  if (match) {
    return match[2]
  }
  return msg
}
