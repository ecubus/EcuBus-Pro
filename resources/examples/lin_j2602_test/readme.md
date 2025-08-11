# LIN SAE J2602 Test Example

This example demonstrates comprehensive LIN SAE J2602 testing using EcuBus-Pro and LinCable, following the SAE J2602-2 standard. The test suite validates LIN protocol compliance, timing parameters, and error handling capabilities through advanced fault injection techniques.

## Overview

The LIN SAE J2602 test example provides a complete testing framework for validating LIN network components according to automotive industry standards. It leverages LinCable's advanced fault injection capabilities to simulate various error conditions and verify proper error handling in LIN slave nodes.

You can modify the test script to implement your own additional test requirements.

## Used Devices

- **[EcuBus-LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)**: USB-to-LIN adapter with advanced fault injection capabilities (required for error injection testing)

> [!NOTE]
> Fault injection testing requires EcuBus-LinCable as it is the only device capable of performing error injection operations. Standard LIN adapters cannot perform these advanced testing functions.

## Test Database

The test database is in the [LINdb.ldf](https://github.com/ecubus-pro/ecubus-pro/blob/main/resources/examples/lin_j2602_test/J2602_VectorExample.ldf) file.
