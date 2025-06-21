

import udsoncan
from doipclient import DoIPClient
from doipclient.connectors import DoIPClientUDSConnector
from udsoncan.client import Client
from udsoncan.exceptions import *
from udsoncan.services import *

udsoncan.setup_logging()

ecu_ip = '127.0.0.1'
ecu_logical_address = 100
ecu_functional_address = 101
doip_client = DoIPClient(ecu_ip, ecu_logical_address,client_logical_address=200)

# send a functional request to the ECU
doip_client.send_diagnostic_to_address(ecu_functional_address,bytearray([0x10,0x05]))
conn = DoIPClientUDSConnector(doip_client)
with Client(conn, request_timeout=2) as client:
   try:
      client.change_session(DiagnosticSessionControl.Session.extendedDiagnosticSession)  # integer with value of 3
                                      # HardReset = 0x01
   except NegativeResponseException as e:
      print('Server refused our request for service %s with code "%s" (0x%02x)' % (e.response.service.get_name(), e.response.code_name, e.response.code))
   except (InvalidResponseException, UnexpectedResponseException) as e:
      print('Server sent an invalid payload : %s' % e.response.original_payload)

# Cleanup the DoIP Socket when we're done. Alternatively, we could have used the
# close_connection flag on conn so that the udsoncan client would clean it up
doip_client.close()