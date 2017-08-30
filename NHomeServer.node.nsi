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

Name "EynioConnect"
InstallDir "c:\EynioConnect"

RequestExecutionLevel user

VIAddVersionKey "ProductName" "EynioConnect"
VIAddVersionKey "CompanyName" "Eynio"
VIAddVersionKey "LegalCopyright" "Copyright Eynio 2017"
VIAddVersionKey "FileDescription" "EynioConnect Installer"
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

Section "EynioConnect program"
  SectionIn RO

  SetOutPath "$INSTDIR"
  File /r "*.*"
  
SectionEnd

Section "Start Menu Shortcuts"
  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\EynioConnect"
  CreateShortCut "$SMPROGRAMS\EynioConnect\Uninstall.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
  CreateShortCut "$SMPROGRAMS\EynioConnect\EynioConnect.lnk" "$INSTDIR\server.exe" "" "$INSTDIR\server.ico" 0
SectionEnd

Section "Desktop Icons"
  SetShellVarContext current
  CreateShortCut "$DESKTOP\EynioConnect.lnk" "$INSTDIR\server.exe" "" "$INSTDIR\server.ico" 0
SectionEnd

Section "Start on boot"
  SetShellVarContext current
  CreateShortCut "$SMSTARTUP\EynioConnect.lnk" "$INSTDIR\server.exe" "--autostart" "$INSTDIR\server.ico" 0
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete /rebootok "$DESKTOP\EynioConnect.lnk"
  Delete /rebootok "$SMPROGRAMS\EynioConnect\EynioConnect.lnk"
  Delete /rebootok "$SMPROGRAMS\EynioConnect\Uninstall.lnk"
  Delete /rebootok "$SMSTARTUP\EynioConnect.lnk"
  RMDir "$SMPROGRAMS\EynioConnect"
  RMDir /r /rebootok "$APPDATA\Eynio\EynioConnect"
  RMDir /r /rebootok "$INSTDIR"
SectionEnd

Section -post
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd
