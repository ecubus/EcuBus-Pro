# 监控信号变化并打印时间间隔

> [!INFO]
> CAPL 脚本由 Sanshao 提供

## CAPL

```capl
variables
{
  long lastValue;         // previous signal value
  long lastTime;          // previous transition time
  long jumpCount = 0;
  long tm[9];// time array
}
on start
{
  lastValue = $EngState; 
  getLocalTime(tm);
  lastTime = tm[0]+tm[1]*60;
  jumpCount = 0;
}

// signal transition event
on signal_update EngState
{
   long nowtime;
  long interval;
  long tm1[9];

  if ($EngState != lastValue)
  {
     getLocalTime(tm1);
    
     nowtime = tm1[0]+tm1[1]*60;
     interval = nowtime - lastTime;
  
    lastTime = nowtime;
    lastValue = $EngState;
    
    write("Transition interval: %d",interval);
  }
}
```

## EcuBus-Pro 脚本

```typescript
let lastValue: number|undefined;
let lastTime: number = 0;
let jumpCount: number = 0;


Util.Init(() => {   
    lastTime= new Date().getTime();
})

// signal transition event
Uitl.OnSignal('Model3CAN.VCLEFT_liftgateLatchRequest',({rawValue,physValue}) => {
    if(rawValue != lastValue){
        const nowTime = new Date().getTime();
        const interval = nowTime - lastTime;
        lastTime = nowTime;
        lastValue = rawValue;
        console.log(`Transition interval: ${interval}ms`);
    }
})
```
