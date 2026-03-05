# CAN DBC & ARXML

EcuBus-Pro uses [python-canmatrix](https://github.com/canmatrix/canmatrix) to parse and convert CAN database files. If you encounter any import or parsing issues, please report them on our [Github Issues](https://github.com/ecubus/EcuBus-Pro/issues) page, or directly on [canmatrix Issues](https://github.com/canmatrix/canmatrix/issues) if the problem appears to be with the parser itself.

**Import:** DBC and ARXML formats are supported.  
**Export:** Databases can be exported to DBC, ARXML, Excel, JSON, YAML, KCD, DBF, and SYM formats.

The application provides an efficient search interface for messages and signals.

## Import a Database File

![alt text](../../../../media/um/database/dbc/image-18.png)

## Overview

The database viewer provides comprehensive information about:

- Network Nodes
- Messages
- Signals

![alt text](../../../../media/um/database/dbc/image-19.png)

## Value Tables

Value tables define the mapping between raw values and their corresponding meanings.

![alt text](../../../../media/um/database/dbc/image-20.png)

## Attributes

View and inspect all database attributes.

![alt text](../../../../media/um/database/dbc/image-21.png)

## Export

Export the loaded database to other formats: DBC, ARXML, Excel (XLSX), JSON, YAML, KCD, DBF, or SYM. Select the desired format and save the file.

![export](../../../../media/um/database/dbc/export.png)
