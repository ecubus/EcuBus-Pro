import { DiagResponse,DiagRequest, ServiceItem, output, LinDirection, LinChecksumType, setSignal} from "ECB";



Util.On("Tester_lin_1.DiagnosticSessionControl160.send",async (v)=>{
    console.log("Tester_lin_1.DiagnosticSessionControl160.send")
    const resp=DiagResponse.fromDiagRequest(v)
    await resp.outputDiag()
})

Util.OnKey('c',async ()=>{
    await output({
        frameId: 0x3c,
        data: Buffer.from([2,1,0xb6,0xff,0xff,0xff,0xff,0xff]),
        direction: LinDirection.SEND,
        checksumType: LinChecksumType.CLASSIC
    })
})

let val=0
setInterval(() => {
    console.log("setSignal",val)
    setSignal("lin.MotorDirection",val++).then(()=>{
        console.log("setSignal success")
    })
}, 2000);