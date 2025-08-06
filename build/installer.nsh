!macro customFinishPage
  Function AddToPathFunc
    Push $R0
    Push $R1
    
    ; Check for write access to HKLM
    EnVar::Check "NULL" "NULL"
    Pop $R0
    StrCmp $R0 "0" HKLMWriteAccess HKCUWriteAccess
    
    HKLMWriteAccess:
      ; Set to HKLM for system-wide PATH
      EnVar::SetHKLM
      ; Set the CLI directory path
      StrCpy $R1 "$INSTDIR\resources\app.asar.unpacked\resources\lib"
      
      ; Check if path exists
      EnVar::Check "PATH" "$R1"
      Pop $R0
      
      ; If path doesn't exist (non-zero), add it
      StrCmp $R0 "0" PathExists AddPath
      
      ; Path doesn't exist, add it
      AddPath:
        EnVar::AddValue "PATH" "$R1"
        Pop $R0
        
      PathExists:
        Pop $R1
        Pop $R0
        Return
    
    HKCUWriteAccess:
      ; Set to HKCU for user-specific PATH
      EnVar::SetHKCU
      ; Set the CLI directory path
      StrCpy $R1 "$INSTDIR\resources\app.asar.unpacked\resources\lib"
      
      ; Check if path exists
      EnVar::Check "PATH" "$R1"
      Pop $R0
      
      ; If path doesn't exist (non-zero), add it
      StrCmp $R0 "0" PathExistsHKCU AddPathHKCU
      
      ; Path doesn't exist, add it
      AddPathHKCU:
        EnVar::AddValue "PATH" "$R1"
        Pop $R0
        
      PathExistsHKCU:
        Pop $R1
        Pop $R0
  FunctionEnd

  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION  "AddToPathFunc"
  !define MUI_FINISHPAGE_SHOWREADME_TEXT  "Add ecu_cli to PATH"

  !define MUI_FINISHPAGE_LINK "Release Notes"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://app.whyengineer.com/docs/dev/releases_note.html"
  !define MUI_FINISHPAGE_LINK_COLOR "fe8b00"

  !insertmacro MUI_PAGE_FINISH
!macroend


