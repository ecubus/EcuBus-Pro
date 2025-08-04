# Vehicle Identification Request Behavior

we support 4 VIN request methods:

1. Unicast VIN Request
2. Omit VIN, tcp connect directly
3. Broadcast VIN Request (UDP4)
4. Multicast VIN Request (UDP6)

![alt text](image-5.png)

## Unicast VIN Request

> [!NOTE]
> This method is only setup Request Address.
>

![alt text](image.png)
![alt text](image-1.png)


## Omit VIN, tcp connect directly

without UDP request, connect directly to the tcp server, see [[#82](https://github.com/ecubus/EcuBus-Pro/issues/82)]

> [!NOTE]
> This method is only setup Request Address.
>

![alt text](image-2.png)

## Broadcast VIN Request (UDP4)

![alt text](image-3.png)
![alt text](image-4.png)

## Multicast VIN Request (UDP6)

unsupported yet.
