@echo off
set SWIG=swig
"%SWIG%" -I"./../inc" -c++ -javascript -napi -v ./cmsis_dap.i
