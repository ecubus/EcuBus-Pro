import {setSignal} from 'ECB'
let val=0;
setInterval(() => {
    setSignal("Model3CAN.VCLEFT_liftgateLatchRequest",(val++)%5);
}, 1000);