# @microdrop/builder nsis instructions

1. Run electron-packager.config.js (in root of @microdrop/builder)
2. Run init.js in the nsis directory; this will fetch miniconda.exe and move the output of packager into the nsis directory
3. Run miniconda.exe and set the install location to be <packager/nsis directory>/MicroDrop/miniconda
4. Create a 7-zip archive of the MicroDrop folder in the nsis directory (right click MicroDrop -> 7-Zip -> Add to "MicroDrop.7z")
5. Configure the script.nsh file if necessary
6. Run makensis.exe (I prefer to use the MakeNSIS: Compile command from build-makensis Atom package)
