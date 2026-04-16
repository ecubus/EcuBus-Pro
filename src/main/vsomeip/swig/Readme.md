


# SWIG Specific

default SWIG JS unsupport shared_ptr, so we need to use https://github.com/mmomtchev/swig

After changing `vsomeip.i`, `send.hpp`, or other SWIG inputs, regenerate `vsomeip_wrap.cxx` from this directory (see `s.bat` for the full `swig` command line), then run `npm run someip` to rebuild the native addon. Do not hand-edit `vsomeip_wrap.cxx`.



