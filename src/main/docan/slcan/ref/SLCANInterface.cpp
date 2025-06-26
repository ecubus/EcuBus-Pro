/*

  Copyright (c) 2022 Ethan Zonca

  This file is part of cangaroo.

  cangaroo is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 2 of the License, or
  (at your option) any later version.

  cangaroo is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with cangaroo.  If not, see <http://www.gnu.org/licenses/>.

*/

#include "SLCANInterface.h"

#include <core/Backend.h>
#include <core/MeasurementInterface.h>
#include <core/CanMessage.h>

#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include <fcntl.h>
#include <QString>
#include <QStringList>
#include <QProcess>
#include <QtSerialPort/QSerialPort>
#include <QtSerialPort/QSerialPortInfo>
#include <QThread>

SLCANInterface::SLCANInterface(SLCANDriver *driver, int index, QString name, bool fd_support)
  : CanInterface((CanDriver *)driver),
	_idx(index),
    _isOpen(false),
    _serport(NULL),
    _msg_queue(),
    _name(name),
    _rx_linbuf_ctr(0),
    _rxbuf_head(0),
    _rxbuf_tail(0),
    _ts_mode(ts_mode_SIOCSHWTSTAMP)
{
    // Set defaults
    _settings.setBitrate(500000);
    _settings.setSamplePoint(875);

    _config.supports_canfd = fd_support;
}

SLCANInterface::~SLCANInterface() {
}

QString SLCANInterface::getDetailsStr() const {
    if(_config.supports_canfd)
    {
        return "CANable with CANFD support";
    }
    else
    {
        return "CANable with standard CAN support";
    }
}

QString SLCANInterface::getName() const {
	return _name;
}

void SLCANInterface::setName(QString name) {
    _name = name;
}

QList<CanTiming> SLCANInterface::getAvailableBitrates()
{
    QList<CanTiming> retval;
    QList<unsigned> bitrates({10000, 20000, 50000, 83333, 100000, 125000, 250000, 500000, 800000, 1000000});
    QList<unsigned> bitrates_fd({0, 2000000, 5000000});

    QList<unsigned> samplePoints({875});

    unsigned i=0;
    foreach (unsigned br, bitrates) {
        foreach(unsigned br_fd, bitrates_fd) {
            foreach (unsigned sp, samplePoints) {
                retval << CanTiming(i++, br, br_fd, sp);
            }
        }
    }

    return retval;
}


void SLCANInterface::applyConfig(const MeasurementInterface &mi)
{
    // Save settings for port configuration
    _settings = mi;
}

bool SLCANInterface::updateStatus()
{
    return false;
}

bool SLCANInterface::readConfig()
{
    return false;
}

bool SLCANInterface::readConfigFromLink(rtnl_link *link)
{
    return false;
}

bool SLCANInterface::supportsTimingConfiguration()
{
    return _config.supports_timing;
}

bool SLCANInterface::supportsCanFD()
{
    return _config.supports_canfd;
}

bool SLCANInterface::supportsTripleSampling()
{
    return false;
}

unsigned SLCANInterface::getBitrate()
{
    return _settings.bitrate();
}

uint32_t SLCANInterface::getCapabilities()
{
    uint32_t retval =
        CanInterface::capability_config_os |
        CanInterface::capability_listen_only |
        CanInterface::capability_auto_restart;

    if (supportsCanFD()) {
        retval |= CanInterface::capability_canfd;
    }

    if (supportsTripleSampling()) {
        retval |= CanInterface::capability_triple_sampling;
    }

    return retval;
}

bool SLCANInterface::updateStatistics()
{
    return updateStatus();
}

uint32_t SLCANInterface::getState()
{
    if(_isOpen)
        return state_ok;
    else
        return state_bus_off;
}

int SLCANInterface::getNumRxFrames()
{
    return _status.rx_count;
}

int SLCANInterface::getNumRxErrors()
{
    return _status.rx_errors;
}

int SLCANInterface::getNumTxFrames()
{
    return _status.tx_count;
}

int SLCANInterface::getNumTxErrors()
{
    return _status.tx_errors;
}

int SLCANInterface::getNumRxOverruns()
{
    return _status.rx_overruns;
}

int SLCANInterface::getNumTxDropped()
{
    return _status.tx_dropped;
}

int SLCANInterface::getIfIndex() {
    return _idx;
}

void SLCANInterface::open()
{
    if(_serport != NULL)
    {
        delete _serport;
    }

    _serport = new QSerialPort();

    _serport_mutex.lock();
    _serport->setPortName(_name);
    _serport->setBaudRate(1000000);
    _serport->setDataBits(QSerialPort::Data8);
    _serport->setParity(QSerialPort::NoParity);
    _serport->setStopBits(QSerialPort::OneStop);
    _serport->setFlowControl(QSerialPort::NoFlowControl);
    _serport->setReadBufferSize(2048);
    if (_serport->open(QIODevice::ReadWrite)) {
        //perror("Serport connected!");
    } else {
        perror("Serport connect failed!");
        _serport_mutex.unlock();
        _isOpen = false;
        return;
    }
    _serport->flush();
    _serport->clear();

    // Set the classic CAN bitrate
    switch(_settings.bitrate())
    {
        case 1000000:
            _serport->write("S8\r", 3);
            _serport->flush();
            break;
        case 750000:
            _serport->write("S7\r", 3);
            _serport->flush();
            break;
        case 500000:
            _serport->write("S6\r", 3);
            _serport->flush();
            break;
        case 250000:
            _serport->write("S5\r", 3);
            _serport->flush();
            break;
        case 125000:
            _serport->write("S4\r", 3);
            _serport->flush();
            break;
        case 100000:
            _serport->write("S3\r", 3);
            _serport->flush();
            break;
        case 83333:
            _serport->write("S9\r", 3);
            _serport->flush();
            break;
        case 50000:
            _serport->write("S2\r", 3);
            _serport->flush();
            break;
        case 20000:
            _serport->write("S1\r", 3);
            _serport->flush();
            break;
        case 10000:
            _serport->write("S0\r", 3);
            _serport->flush();
            break;
        default:
            // Default to 10k
            _serport->write("S0\r", 3);
            _serport->flush();
            break;
    }

    _serport->waitForBytesWritten(300);



    // Set configured BRS rate
    if(_config.supports_canfd)
    {
        switch(_settings.fdBitrate())
        {
            case 2000000:
                _serport->write("Y2\r", 3);
                _serport->flush();
                break;
            case 5000000:
                _serport->write("Y5\r", 3);
                _serport->flush();
                break;
        }
    }

    _serport->waitForBytesWritten(300);


    // Open the port
    _serport->write("O\r\n", 3);
    _serport->flush();

    _isOpen = true;

    // Release port mutex
    _serport_mutex.unlock();
}

void SLCANInterface::close()
{
    _serport_mutex.lock();

    if (_serport->isOpen())
    {
        // Close CAN port
        _serport->write("C\r", 2);        
        _serport->flush();
        _serport->waitForBytesWritten(300);
        _serport->clear();
        _serport->close();
    }

    _isOpen = false;
    _serport_mutex.unlock();
}

bool SLCANInterface::isOpen()
{
    return _isOpen;
}

void SLCANInterface::sendMessage(const CanMessage &msg) {

    // SLCAN_MTU plus null terminator
    char buf[SLCAN_MTU+1] = {0};

    uint8_t msg_idx = 0;

    // Message is FD
    // Add character for frame type
    if(msg.isFD())
    {
        if(msg.isBRS())
        {
            buf[msg_idx] = 'b';

        }
        else
        {
            buf[msg_idx] = 'd';
        }
    }
    // Message is not FD
    // Add character for frame type
    else
    {
        if (msg.isRTR()) {
            buf[msg_idx] = 'r';
        }
        else
        {
            buf[msg_idx] = 't';
        }
    }

    // Assume standard identifier
    uint8_t id_len = SLCAN_STD_ID_LEN;
    uint32_t tmp = msg.getId();

    // Check if extended
    if (msg.isExtended())
    {
        // Convert first char to upper case for extended frame
        buf[msg_idx] -= 32;
        id_len = SLCAN_EXT_ID_LEN;
    }
    msg_idx++;

    // Add identifier to buffer
    for(uint8_t j = id_len; j > 0; j--)
    {
        // Add nibble to buffer
        buf[j] = (tmp & 0xF);
        tmp = tmp >> 4;
        msg_idx++;
    }

    // Sanity check length
    int8_t bytes = msg.getLength();


    if(bytes < 0)
        return;
    if(bytes > 64)
        return;

    // If canfd
    if(bytes > 8)
    {
        switch(bytes)
        {
        case 12:
            bytes = 0x9;
            break;
        case 16:
            bytes = 0xA;
            break;
        case 20:
            bytes = 0xB;
            break;
        case 24:
            bytes = 0xC;
            break;
        case 32:
            bytes = 0xD;
            break;
        case 48:
            bytes = 0xE;
            break;
        case 64:
            bytes = 0xF;
            break;
        }
    }

    // Add DLC to buffer
    buf[msg_idx++] = bytes;

    // Add data bytes
    for (uint8_t j = 0; j < msg.getLength(); j++)
    {
        buf[msg_idx++] = (msg.getByte(j) >> 4);
        buf[msg_idx++] = (msg.getByte(j) & 0x0F);
    }

    // Convert to ASCII (2nd character to end)
    for (uint8_t j = 1; j < msg_idx; j++)
    {
        if (buf[j] < 0xA) {
            buf[j] += 0x30;
        } else {
            buf[j] += 0x37;
        }
    }

    // Add CR for slcan EOL
    buf[msg_idx++] = '\r';

    // Ensure null termination
    buf[msg_idx] = '\0';

    _msg_queue.append(QString(buf));

}

bool SLCANInterface::readMessage(QList<CanMessage> &msglist, unsigned int timeout_ms)
{
    // Don't saturate the thread. Read the buffer every 1ms.
    QThread().msleep(1);

    // Transmit all items that are queued
    while(!_msg_queue.empty())
    {
        // Consume first item
        QString tmp = _msg_queue.front();
        _msg_queue.pop_front();

        _serport_mutex.lock();
        // Write string to serial device
        _serport->write(tmp.toStdString().c_str(), tmp.length());
        _serport->flush();
        _serport->waitForBytesWritten(300);
        _serport_mutex.unlock();
    }

    // RX doesn't work on windows unless we call this for some reason
    _serport->waitForReadyRead(1);

    if(_serport->bytesAvailable())
    {
        // This is called when readyRead() is emitted
        QByteArray datas = _serport->readAll();
        _rxbuf_mutex.lock();
        for(int i=0; i<datas.count(); i++)
        {
            // If incrementing the head will hit the tail, we've filled the buffer. Reset and discard all data.
            if(((_rxbuf_head + 1) % RXCIRBUF_LEN) == _rxbuf_tail)
            {
                _rxbuf_head = 0;
                _rxbuf_tail = 0;
            }
            else
            {
                // Put inbound data at the head locatoin
                _rxbuf[_rxbuf_head] = datas.at(i);
                _rxbuf_head = (_rxbuf_head + 1) % RXCIRBUF_LEN; // Wrap at MTU
            }
        }
        _rxbuf_mutex.unlock();
    }



    //////////////////////////

    bool ret = false;
    _rxbuf_mutex.lock();
    while(_rxbuf_tail != _rxbuf_head)
    {
        // Save data if room
        if(_rx_linbuf_ctr < SLCAN_MTU)
        {
            _rx_linbuf[_rx_linbuf_ctr++] = _rxbuf[_rxbuf_tail];

            // If we have a newline, then we just finished parsing a CAN message.
            if(_rxbuf[_rxbuf_tail] == '\r')
            {
                CanMessage msg;
                ret = parseMessage(msg);
                msglist.append(msg);
                _rx_linbuf_ctr = 0;
            }
        }
        // Discard data if not
        else
        {
            perror("Linbuf full");
            _rx_linbuf_ctr = 0;
        }

        _rxbuf_tail = (_rxbuf_tail + 1) % RXCIRBUF_LEN;
    }
    _rxbuf_mutex.unlock();

    return ret;
}

bool SLCANInterface::parseMessage(CanMessage &msg)
{
    // Set timestamp to current time
    struct timeval tv;
    gettimeofday(&tv,NULL);
    msg.setTimestamp(tv);

    // Defaults
    msg.setErrorFrame(0);
    msg.setInterfaceId(getId());
    msg.setId(0);

    bool msg_is_fd = false;

    // Convert from ASCII (2nd character to end)
    for (int i = 1; i < _rx_linbuf_ctr; i++)
    {
        // Lowercase letters
        if(_rx_linbuf[i] >= 'a')
            _rx_linbuf[i] = _rx_linbuf[i] - 'a' + 10;
        // Uppercase letters
        else if(_rx_linbuf[i] >= 'A')
            _rx_linbuf[i] = _rx_linbuf[i] - 'A' + 10;
        // Numbers
        else
            _rx_linbuf[i] = _rx_linbuf[i] - '0';
    }


    // Handle each incoming command
    switch(_rx_linbuf[0])
    {

        // Transmit data frame command
        case 'T':
            msg.setExtended(1);
            break;
        case 't':
            msg.setExtended(0);
            break;

        // Transmit remote frame command
        case 'r':
            msg.setExtended(0);
            msg.setRTR(1);
            break;
        case 'R':
            msg.setExtended(1);
            msg.setRTR(1);
            break;

        // CANFD transmit - no BRS
        case 'd':
            msg.setExtended(0);
            msg_is_fd = true;
            break;
        case 'D':
            msg.setExtended(1);
            msg_is_fd = true;
            break;

        // CANFD transmit - with BRS
        case 'b':
            msg.setExtended(0);
            msg_is_fd = true;
            break;
        case 'B':
            msg.setExtended(1);
            msg_is_fd = true;
            break;



        // Invalid command
        default:
            return false;
    }

    // Start parsing at second byte (skip command byte)
    uint8_t parse_loc = 1;

    // Default to standard id len
    uint8_t id_len = SLCAN_STD_ID_LEN;

    // Update length if message is extended ID
    if(msg.isExtended())
        id_len = SLCAN_EXT_ID_LEN;

    uint32_t id_tmp = 0;

    // Iterate through ID bytes
    while(parse_loc <= id_len)
    {
        id_tmp *= 16;
        id_tmp += _rx_linbuf[parse_loc++];
    }


    msg.setId(id_tmp);

    // Attempt to parse DLC and check sanity
    uint8_t dlc_code_raw = _rx_linbuf[parse_loc++];

    // If dlc is too long for an FD frame
    if(msg_is_fd && dlc_code_raw > 0xF)
    {
        return false;
    }
    if(!msg_is_fd && dlc_code_raw > 0x8)
    {
        return false;
    }

    if(dlc_code_raw > 0x8)
    {
        switch(dlc_code_raw)
        {
        case 0x9:
            dlc_code_raw = 12;
            break;
        case 0xA:
            dlc_code_raw = 16;
            break;
        case 0xB:
            dlc_code_raw = 20;
            break;
        case 0xC:
            dlc_code_raw = 24;
            break;
        case 0xD:
            dlc_code_raw = 32;
            break;
        case 0xE:
            dlc_code_raw = 48;
            break;
        case 0xF:
            dlc_code_raw = 64;
            break;
        default:
            dlc_code_raw = 0;
            perror("Invalid length");
            break;
        }
    }

    msg.setLength(dlc_code_raw);

    // Calculate number of bytes we expect in the message
    int8_t bytes_in_msg = dlc_code_raw;

    if(bytes_in_msg < 0) {
        perror("Invalid length < 0");
        return false;
    }
    if(bytes_in_msg > 64) {
        perror("Invalid length > 64");
        return false;
    }

    // Parse data
    // TODO: Guard against walking off the end of the string!
    for (uint8_t i = 0; i < bytes_in_msg; i++)
    {
        msg.setByte(i,  (_rx_linbuf[parse_loc] << 4) + _rx_linbuf[parse_loc+1]);
        parse_loc += 2;
    }

    // Reset buffer
    _rx_linbuf_ctr = 0;
    _rx_linbuf[0] = '\0';
    return true;


/*

    // FIXME
    if (_ts_mode == ts_mode_SIOCSHWTSTAMP) {
        // TODO implement me
        _ts_mode = ts_mode_SIOCGSTAMPNS;
    }

    if (_ts_mode==ts_mode_SIOCGSTAMPNS) {
        if (ioctl(_fd, SIOCGSTAMPNS, &ts_rcv) == 0) {
            msg.setTimestamp(ts_rcv.tv_sec, ts_rcv.tv_nsec/1000);
        } else {
            _ts_mode = ts_mode_SIOCGSTAMP;
        }
    }

    if (_ts_mode==ts_mode_SIOCGSTAMP) {
        ioctl(_fd, SIOCGSTAMP, &tv_rcv);
        msg.setTimestamp(tv_rcv.tv_sec, tv_rcv.tv_usec);
    }*/


}
