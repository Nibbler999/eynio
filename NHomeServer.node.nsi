#!Nsis Installer Command Script
#
# This is an NSIS Installer Command Script generated automatically
# by the Fedora nsiswrapper program.  For more information see:
#
#   http://fedoraproject.org/wiki/MinGW
#
# To build an installer from the script you would normally do:
#
#   makensis this_script
#
# which will generate the output file 'installer.exe' which is a Windows
# installer containing your program.

# Modern UI
!include MUI2.nsh

Name "EynioServer"
InstallDir "c:\EynioServer"

RequestExecutionLevel user

VIAddVersionKey "ProductName" "EynioServer"
VIAddVersionKey "CompanyName" "Eynio"
VIAddVersionKey "LegalCopyright" "Copyright Eynio 2016"
VIAddVersionKey "FileDescription" "EynioServer Installer"
VIAddVersionKey "FileVersion" "VERSIONDATA1"

VIProductVersion "VERSIONDATA2"

ShowInstDetails hide
ShowUninstDetails hide

SetCompressor /FINAL /SOLID lzma
SetCompressorDictSize 64
CRCCheck force

XPStyle on

!define MUI_COMPONENTSPAGE_NODESC

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

ComponentText "Select which optional components you want to install."

DirText "Please select the installation folder."

Section "EynioServer program"
  SectionIn RO

  SetOutPath "$INSTDIR"
  File /r "*.*"
  
SectionEnd

Section "Start Menu Shortcuts"
  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\EynioServer"
  CreateShortCut "$SMPROGRAMS\EynioServer\Uninstall.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
  CreateShortCut "$SMPROGRAMS\EynioServer\EynioServer.lnk" "$INSTDIR\server.exe" "" "$INSTDIR\server.ico" 0
SectionEnd

Section "Desktop Icons"
  SetShellVarContext current
  CreateShortCut "$DESKTOP\EynioServer.lnk" "$INSTDIR\server.exe" "" "$INSTDIR\server.ico" 0
SectionEnd

Section "Start on boot"
  SetShellVarContext current
  CreateShortCut "$SMSTARTUP\EynioServer.lnk" "$INSTDIR\server.exe" "--autostart" "$INSTDIR\server.ico" 0
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete /rebootok "$DESKTOP\EynioServer.lnk"
  Delete /rebootok "$SMPROGRAMS\EynioServer\EynioServer.lnk"
  Delete /rebootok "$SMPROGRAMS\EynioServer\Uninstall.lnk"
  Delete /rebootok "$SMSTARTUP\EynioServer.lnk"
  RMDir "$SMPROGRAMS\EynioServer"
  RMDir /r /rebootok "$APPDATA\Eynio\EynioServer"
  RMDir /r /rebootok "$INSTDIR"
SectionEnd

Section -post
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd
