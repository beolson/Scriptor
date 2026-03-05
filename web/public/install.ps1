$tmp = "$env:TEMP\scriptor.exe"
Invoke-WebRequest -Uri "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-windows-x64.exe" -OutFile $tmp
& $tmp
