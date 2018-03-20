!define APPNAME "MicroDrop"
!define COMPANYNAME "Sci-Bots"
!define ZIPFILE "MicroDrop.7z"
!define DIRNAME "MicroDrop"

InstallDir "$PROFILE\microdrop"
DirText "Choose a folder in which to install"
LicenseData "license.rtf"

page license
page directory
page instfiles

Section
  DetailPrint $TEMP
  SetOutPath $INSTDIR

  # Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  File "${ZIPFILE}"
  File "logo.ico"
  File "license.rtf"

  Nsis7z::ExtractWithDetails "$INSTDIR\${ZIPFILE}"

  Var /GLOBAL MINICONDA
  StrCpy $MINICONDA "$INSTDIR\${DIRNAME}\miniconda"

  # Start Menu
  createDirectory "$SMPROGRAMS\${COMPANYNAME}"
  createShortCut "$SMPROGRAMS\${COMPANYNAME}\${APPNAME}.lnk" "$MINICONDA\pythonw.exe" "$MINICONDA\cwp.py $MINICONDA $WINDIR\system32\cmd.exe /c start $MINICONDA\Scripts\activate.bat $MINICONDA && $WINDIR\system32\cmd.exe /c start $INSTDIR\${DIRNAME}\MicroDrop.exe" "$INSTDIR\logo.ico"

  Delete "$INSTDIR\${ZIPFILE}"

SectionEnd

Section "uninstall"
  rmDir /r $INSTDIR
SectionEnd
