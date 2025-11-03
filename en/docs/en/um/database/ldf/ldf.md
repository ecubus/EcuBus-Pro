# LIN LDF

The LDF parser supports the following LIN Specification versions:

- 2.2
- 2.1
- 2.0

## Selecting an LDF File

![alt text](image-4.png)

## Saving the Database

When creating a new database, you must assign a unique name and save it.
![alt text](image-5.png)

## LDF Editor

You can edit the LDF database through different tabs. Each section implements strict error checking to ensure data integrity.

### General

This tab displays general database information and error notifications. All errors must be resolved before saving or using the database.
![alt text](image-6.png)

### Nodes

Configure slave node attributes in this section. Strict error checking is implemented to validate node configurations.
![alt text](image-7.png)
![alt text](image-8.png)

### Signals

Manage signal information in this tab. Erroneous signals will be highlighted. All signal configurations undergo strict validation.
![alt text](image-9.png)
![alt text](image-10.png)

### Frames

This section shows Unconditional frames only. Other frame types can be configured in the Schedule table. Erroneous frames will be highlighted. Strict error checking ensures frame integrity.
![alt text](image-11.png)
![alt text](image-12.png)

### Schedule

Configure schedule tables and add frames to them in this section. All schedule configurations are strictly validated.
![alt text](image-13.png)
![alt text](image-14.png)

### Encode

Define encoding information here. Signal encoding can be edited in the Signals tab after configuration. Strict validation is performed on all encoding definitions.
![alt text](image-15.png)
![alt text](image-16.png)

### LDF

View the real-time LDF file content. You can copy the LDF content from here once all errors are resolved.
![alt text](image-17.png)
