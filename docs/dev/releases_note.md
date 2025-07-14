# EcuBus-Pro Release Notes

## 0.8.47
Changes from v0.8.46 to v0.8.47:

### Highlighted

**[EcuBus LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)** – USB to LIN Adapter for Automotive Development **Launched**!

Features:

* Fault Injection and Conformance Testing
* Advanced LIN Protocol Support
* Cross-Platform and Software Integration
* Open Communication Protocol for Secondary Development
* DFU Firmware Update Support

### Other Changes
 
* [bug]:fix vector lin master can't receive by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/169
* [feat]:run single test case ok 
* [bug]:fix get vendor failed 
* [opt]:opt diff platform vendor 
* [opt]:opt slcan timestamp and canfd 
---


## 0.8.46
Changes from v0.8.45 to v0.8.46:

* [bug]:fix fc send multi times issue
* [feat]:add slcan can can-fd @frankie-zeng in https://github.com/ecubus/EcuBus/pull/165
* [bug]:fix dbc parse signal name has int str 
* [bug]:fix test log overlap 
* [bug]:fix nodeitem flow control by isTest 
* [opt]:make secureAccess work in windows only @frankie-zeng in https://github.com/ecubus/EcuBus/pull/161
* [opt]:esbuild executable bin handling to OS by @sengulhamza in https://github.com/ecubus/EcuBus/pull/163
---



## 0.8.45
Changes from v0.8.44 to v0.8.45:

 
* [opt]:opt tester logical&func address 
* [api]:remove RegisterEthVirtualEntity api, control by simulate_by config in UI 
* [bug]:fix uds 0x85 param can't be delete 
* [bug]:fix dbc calc unmatch 
* [opt]:enable backgroundThrottling 
* [feat]:add trace overwrite mode [Detail](https://app.whyengineer.com/docs/um/trace/trace.html#overwrite-mode)
* [bug]:fix can dbc SIG_GROUP_ can't parse issue 
* [bug]:fix uds negativeResponse issue 
* [bug]:fix can dbc EV_ can't parse issue
---



## 0.8.44
Changes from v0.8.43 to v0.8.44:

 
* [bug]:fix toomoss can clock freq issue 
* [feat]:add dark theme [Detail](https://app.whyengineer.com/docs/um/setting/general.html#theme)
* [example]:add panel example [Detail](https://app.whyengineer.com/examples/panel/readme.html)
* [feat]:add panel led component 
* [bug]:fix var trigger 
* [feat]:opt changeServiceApi 
* [example]:add uds 0x29 example [Detail](https://app.whyengineer.com/examples/uds_0x29/readme.html)
* [bug]:fix worker resp param is not buffer
---



## 0.8.43
Changes from v0.8.42 to v0.8.43:

 
* [feat]:add windows rearrange feature 
* [bug]:fix toomoss lin can't stop 
* [bug]:fix dbc parse global comment error 
* [api]: add linStartScheduler/linStopScheduler api
---



## v0.8.42
Changes from v0.8.41 to v0.8.42:


* [feat]:add UDS code generate ability 
* [bug]:fix doip tcp client fix port TIME_WAIT state 
* [opt]:opt HIL test 
* [opt]:opt multi-windows
---



## v0.8.41
Changes from v0.8.40 to v0.8.41:

 
* [feat]:add parse S19 file api 
* [bug]:fix doip tcp log stream error 
* [feat]:multi windows ok
---



## v0.8.40
Changes from v0.8.39 to v0.8.40:

* [example]:add doip gateway example 
* [bug]:fix doip self entiry log issue 
* [bug]:fix findService unmatch contains service id issue 
---


## v0.8.39
Changes from v0.8.38 to v0.8.39:

 
* [feat]:add doip client ip control [Detail](https://app.whyengineer.com/docs/um/doip/doip.html#tcp-udp-source-port-control)
* [feat]:vector lin adapter support. by @hmf1235789 in #153


**Full Changelog**: https://github.com/ecubus/EcuBus-Pro/compare/v0.8.38...v0.8.39
---



## v0.8.38
Changes from v0.8.37 to v0.8.38:

 
* [bug]:fix uds service param can't save
* [bug]:fix tsconfig nodejs target version
---




## v0.8.37
Changes from v0.8.36 to v0.8.37:

* [bug]:fix LDF parse with space by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/145
* [opt]:allow UDS service with same sub-function, ex: 0x31 by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/146
* [bug]:ZLG device can't close by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/144
* [bug]:fix the baudrate check and overwrite by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/148
* [feat]:add doip version choose by @frankie-zeng in https://github.com/ecubus/EcuBus-Pro/pull/150
* [bug]:fix kvaser multi device
* [feat]:add uds param parse in trace 


**Full Changelog**: https://github.com/ecubus/EcuBus-Pro/compare/v0.8.36...v0.8.37
---



## v0.8.36
Changes from v0.8.35 to v0.8.36:

 
* **[feat]:vector can done**
* [feat]:add device filter in trace 
* [bug]:fix can ia period send data length 
* [opt]:opt can baudrate choose 
* [feat]:add kvaser can silent mode 
* [feat]:add kvaser lin feature
---



## v0.8.35
Changes from v0.8.34 to v0.8.35:

* [feat]:panel feature 
* [feat]:add uds tester simulate by 
* [bug]:fix graph/gauge dynamic enable 
* [bug]:fix can dbc parse error 
---



## v0.8.34
Changes from v0.8.33 to v0.8.34:

 
* [bug]:fix zlg can-fd device init error 
* [bug]:fix ipc get version bug, it will failed when driver not installed
---



## v0.8.33
Changes from v0.8.32 to v0.8.33:

* [bug]:fix zlg can device echo
* [feat]:add dbc float type support
---



## v0.8.32
Changes from v0.8.31 to v0.8.32:

 
* [bug]:fix api diagIsPositiveResponse error 
* [bug]:fix lin diag slave resp ID error
---



## v0.8.31
Changes from v0.8.30 to v0.8.31:

 
* [bug]:fix freq isn't number type
---



## v0.8.30
Changes from v0.8.29 to v0.8.30:
 
* [feat]:add data graph ok [Detail](https://app.whyengineer.com/docs/um/graph/graph.html)
* [feat]:add var system ok [Detail](https://app.whyengineer.com/docs/um/var/var.html)
* [feat]:add some ZLG device 
* [bug]:fix script buffer outbound 
* [bug]:fix toomoss can event miss 
* [feat]:add toomoss/zlg can 120res control
---



## v0.8.29
Changes from v0.8.28 to v0.8.29:

 
* [feat]:add can tester present #102 [Detail](https://app.whyengineer.com/docs/um/uds/testerPresent.html)
* [bug]:fix channel choose in cani #107 
---

## v0.8.28
Changes from v0.8.27 to v0.8.28:

 
* [bug]:fix PEAK can baudrate bug 
* [bug]:fix layout max windows min containment setup
---

## v0.8.27
Changes from v0.8.26 to v0.8.27:

 
* [bug]:fix ldf comment #99 
* [feat]:add package manage
---

## v0.8.26
Changes from v0.8.25 to v0.8.26:

 
* [feat]:add build *.node and *.dll copy 
* [bug]:fix pnpm not found 
* [opt]:add tip when close software 
* [feat]:add graph gauge feature 
* [feat]:opt lin signal physical value 
* [feat]:add lin encode change
---

## v0.8.25
Changes from v0.8.24 to v0.8.25:

 
* [feat]:add UI zoom feature 
* [feat]:refactor trace done 
* [feat]:add script end callback 
* [feat]:add node-bindings for esbuild, but still need copy .node to .ScriptBuild 
* [bug]:fix toomoss lin output voltage error 
* [feat]:add lin checksum type in trace windows 
* [bug]:fix lin id error 
* [bug]:fix save project failed 
* [bug]:fix lin baudrate isn't number 
* [bug]:Increase ldf parsing compatibility 
* [bug]:fix close project doesn't clean data
---

## v0.8.24
Changes from v0.8.23 to v0.8.24:

 
* [feat]:add toomoss lin 
* [dep]:update axios
---

## v0.8.23
Changes from v0.8.22 to v0.8.23:

 
* [feat]:uds sequence with build in script 
* [feat]:add FILE param to uds service 
* [bug]:fix name check in linAddr
---

## v0.8.22
Changes from v0.8.21 to v0.8.22:

 
* [feat]:add doip connect tcp directly #82
---

## v0.8.21
Changes from v0.8.20 to v0.8.21:

 
* [bug]:fix udp socket close twice #80 
* [bug]:fix eth handle is required #81
---

## v0.8.20
Changes from v0.8.19 to v0.8.20:

 
* [feat]:add ZLG ZCAN_USBCANFD_100U support 
* [bug]:fix white screen
---

## v0.8.19
Changes from v0.8.18 to v0.8.19:

 
* [feat]:cli test ok
---

## v0.8.18
Changes from v0.8.17 to v0.8.18:

 
* [feat]:test framework ok 
* [feat]:test arch base ok 
* [refactor]: Refactor network node logic 
* [bug]:fix log sequence issue
---

## v0.8.17
Changes from v0.8.16 to v0.8.17:

 
* [bug]:fix windows drag resize bug 
* [feat]:add example readme mermaid support 
* [feat]:add hex parse/write script ability
---

## v0.8.16
Changes from v0.8.15 to v0.8.16:

 
* [opt]:opt cani channel choose
---

## v0.8.15
Changes from v0.8.14 to v0.8.15:

 
* [feat]:add can setSingal 
* [feat]:opt can dbc parse 
* [feat]:add signal update 
* [feat]:add prase dbc file
---

## v0.8.14
Changes from v0.8.13 to v0.8.14:

 
* [opt]:opt ui window 
* [bug]:fix diag append, must has transform attribute 
* [opt]:opt tooltip time 
* [feat]:gragh from lin database ok 
* [feat]:add setSignal script api 
* [opt]:opt ldf parse compatibility
---

## v0.8.13
Changes from v0.8.12 to v0.8.13:

 
* [bug]:fix key event not off 
* [feat]:add lin 
* [feat]:add lin-tp 
* [feat]:add uds over lin 
* [feat]:add trace pause/play 
* [feat]:add lin ia 
* [opt]:add ldf parse space and error lines display
---

## v0.8.12
Changes from v0.8.11 to v0.8.12:

 
* [feat]:add LDF database feature
---

## v0.8.11
Changes from v0.8.10 to v0.8.11:

 
* [feat]:add pnpm ability to cli 
* [feat]:add ldfParse code 
* [bug]:fix can-ia data length!=2 issue
---

## v0.8.10
Changes from v0.8.9 to v0.8.10:

 
* [bug]:fix enum export issue 
* [feat]:add script OnKey feature 
* [feat]:add node serialport lib support
---

## v0.8.9
Changes from v0.8.8 to v0.8.9:

 
* [bug]:fix cli seq doesn't close
---

## v0.8.8
Changes from v0.8.7 to v0.8.8:

 
* [cli]:init first cli version, support seq command 
* [feat]:add cli seq ability 
* [opt]:opt can uds cc speed 
* [bug]:fix s can input issue 
* [bug]:fix eid can't input issue
---

## v0.8.7
Changes from v0.8.6 to v0.8.7:

 
* [example]: add doip and doip_sim_entity examples 
* [feat]:add doip feature 
* [bug]:fix peak sja1000 support issue 
* [opt]:opt error form dec to hex
---

## v0.8.6
Changes from v0.8.5 to v0.8.6:

 
* [bug]:fix sa.node lock issue
---

## v0.8.5
Changes from v0.8.4 to v0.8.5:

 
* [feat]:opt release note display 
* [feet]: add portable zip release 
* [feat]: add load dll interface, see [https://app.whyengineer.com/examples/secure_access_dll/readme.html](https://app.whyengineer.com/examples/secure_access_dll/readme.html)
