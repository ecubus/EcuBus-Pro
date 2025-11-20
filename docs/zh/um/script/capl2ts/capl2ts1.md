# 监视信号变化和打印时间间隔

> [!INFO]
> 验证码脚本由 Sanshao 提供

## 验证码

```capl
变量
{
  long lastValue;         // 前一个信号值
  long lastTime;          // 前一个转换时间
  long jumpCount = 0;
  long tm[9];// 时间数组
}
启动时
{
  lastValue = $EngState; 
  获取本地时间(tm);
  lastTime = tm[0]+tm[1]*60;
  jumpCount = 0;
}

// 信号转换事件
信号更新时 EngState
{
   long 当前时间;
  long 间隔;
  long tm1[9];

  if ($EngState != lastValue)
  {
     获取本地时间(tm1);
    
     当前时间 = tm1[0]+tm1[1]*60;
     间隔 = 当前时间 - lastTime;
  
    lastTime = 当前时间;
    lastValue = $EngState;
    
    写入("转换间隔: %d",间隔);
  }
}
```

## EcuBus-Pro Script

```typescript
let lastValue: number|undefined;
let lastTime: number = 0;
let jumpCount: number = 0;


Util.初始化(() => {   
    lastTime= new Date().getTime();
})

// 信号转换事件
Uitl.信号监听('Model3CAN.VCLEFT_liftgateLatchRequest',({rawValue,physValue}) => {
    if(rawValue != lastValue){
        const 当前时间 = new Date().getTime();
        const 间隔 = 当前时间 - lastTime;
        lastTime = 当前时间;
        lastValue = rawValue;
        console.log(`转换间隔: ${间隔}ms`);
    }
})
```
