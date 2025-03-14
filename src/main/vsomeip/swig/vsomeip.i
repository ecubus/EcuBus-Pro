%module  vsomeip

%header %{
#include <windows.h>

#define VSOMEIP_INTERNAL_SUPPRESS_DEPRECATED
#include <vsomeip/vsomeip.hpp>
%}


%wrapper %{

%}

%include <stdint.i>
%include <windows.i>


// Add namespace handling for vsomeip_v3
class runtime{
  
}

namespace vsomeip_v3 {

  typedef uint32_t message_t;
typedef uint16_t service_t;
typedef uint16_t method_t;
typedef uint16_t event_t;

typedef uint16_t instance_t;
typedef uint16_t eventgroup_t;

typedef uint8_t major_version_t;
typedef uint32_t minor_version_t;

typedef uint32_t ttl_t;

typedef uint32_t request_t;
typedef uint16_t client_t;
typedef uint16_t session_t;

typedef uint32_t length_t;

typedef uint8_t protocol_version_t;
typedef uint8_t interface_version_t;

typedef uint8_t byte_t;
typedef uint16_t diagnosis_t;

// Addresses
typedef std::array<byte_t, 4> ipv4_address_t;
typedef std::array<byte_t, 16> ipv6_address_t;
typedef std::uint16_t port_t;

typedef std::string trace_channel_t;

typedef std::string trace_filter_type_t;

typedef std::uint32_t pending_remote_offer_id_t;

typedef std::uint32_t pending_security_update_id_t;

#if defined(_WIN32)
    typedef std::uint32_t uid_t;
    typedef std::uint32_t gid_t;
#else
    typedef ::uid_t uid_t;
    typedef ::uid_t gid_t;
#endif

 enum class state_type_e  : uint8_t ;

// SIP_RPC_684
enum class message_type_e : uint8_t ;

// SIP_RPC_371
enum class return_code_e : uint8_t;

enum class routing_state_e : uint8_t;

enum class offer_type_e : uint8_t;
enum class event_type_e : uint8_t;

enum class security_mode_e : uint8_t;

enum class security_update_state_e : uint8_t;

enum class reliability_type_e : uint8_t;

enum class availability_state_e : uint8_t;

enum class handler_registration_type_e : uint8_t;

enum class endianess_e; 
typedef std::function< void (state_type_e) > state_handler_t;
typedef std::function< void (state_type_e) > state_handler_t;
typedef std::function< void (const std::shared_ptr< message > &) > message_handler_t;
typedef std::function< void (service_t, instance_t, bool) > availability_handler_t;
typedef std::function< void (service_t, instance_t, availability_state_e) > availability_state_handler_t;
typedef std::function< bool (client_t, uid_t, gid_t, bool) > subscription_handler_t;
typedef std::function< bool (client_t, uid_t, gid_t, const std::string &, bool) > subscription_handler_ext_t;
typedef std::function< void (const uint16_t) > error_handler_t;
typedef std::function< void (const service_t, const instance_t, const eventgroup_t,
                             const event_t, const uint16_t) > subscription_status_handler_t;
typedef std::function< void (client_t, uid_t, gid_t, bool,
            std::function< void (const bool) > )> async_subscription_handler_t;
typedef std::function< void (client_t, uid_t, gid_t, const std::string &, bool,
            std::function< void (const bool) > )> async_subscription_handler_ext_t;

typedef std::function< void (const std::vector<std::pair<service_t, instance_t>> &_services) > offered_services_handler_t;
typedef std::function< void () > watchdog_handler_t;
typedef std::function<bool(const remote_info_t&)> sd_acceptance_handler_t;
typedef std::function<void(const ip_address_t&)> reboot_notification_handler_t;
typedef std::function<void()> routing_ready_handler_t;
typedef std::function<void(routing_state_e)> routing_state_handler_t;
typedef std::function<void(security_update_state_e)> security_update_handler_t;
typedef std::function<bool(const message_acceptance_t&)> message_acceptance_handler_t;
using subscription_handler_sec_t       = std::function<bool(client_t, const vsomeip_sec_client_t*, const std::string&, bool)>;
using async_subscription_handler_sec_t = std::function<void(client_t, const vsomeip_sec_client_t*, const std::string&, bool, std::function<void(bool)>)>;

struct ip_address_t;

struct remote_info_t;

struct message_acceptance_t;

typedef std::function<
    bool (const std::shared_ptr<payload> &,
          const std::shared_ptr<payload> &) > epsilon_change_func_t;


struct debounce_filter_t;
}



%include <vsomeip/deprecated.hpp>
// Include the necessary headers
%include <vsomeip/constants.hpp>
%include <vsomeip/export.hpp>
%include <vsomeip/primitive_types.hpp>
%include <vsomeip/enumeration_types.hpp>
%include <vsomeip/message_base.hpp>
%include <vsomeip/structured_types.hpp>
%include <vsomeip/function_types.hpp>
%include <vsomeip/runtime.hpp>
%include <vsomeip/application.hpp>
%include <vsomeip/message.hpp>
%include <vsomeip/payload.hpp>
%include <vsomeip/handler.hpp>
// %include <vsomeip/trace.hpp>
%include <vsomeip/vsomeip.hpp>

%inline %{
void LoadDll(const char* path) {
  SetDllDirectory(path);
}

%}



%init %{


%}
