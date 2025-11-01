# 监听信号的变化，输出时间间隔

> [!INFO]
> CAPL脚本由三少提供

## CAPL

```capl
variables
{
  long lastValue;         // 上一次信号值
  long lastTime;          // 上一次跳变时间
  long jumpCount = 0;
  long tm[9];// 
}
on start
{
  lastValue = $EngState; 
  getLocalTime(tm);
  lastTime = tm[0]+tm[1]*60;
  jumpCount = 0;
}

// 信号跳变事件
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
    
    write("跳变时间，%d",interval);
  }
}
```



## EcuBus-Pro脚本

```typescript
let lastValue: number|undefined;
let lastTime: number = 0;
let jumpCount: number = 0;


Util.Init(() => {   
    lastTime= new Date().getTime();
})

// 信号跳变事件
Uitl.OnSignal('Model3CAN.VCLEFT_liftgateLatchRequest',({rawValue,physValue}) => {
    if(rawValue != lastValue){
        const nowTime = new Date().getTime();
        const interval = nowTime - lastTime;
        lastTime = nowTime;
        lastValue = rawValue;
        console.log(`跳变时间，${interval}ms`);
    }
})
```
