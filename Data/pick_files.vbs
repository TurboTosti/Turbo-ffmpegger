' pick_files.vbs — called by the HTA to show a file picker
' Usage: cscript pick_files.vbs "output_path.txt"
' Writes selected file paths (one per line) to output_path.txt

Dim outFile
outFile = WScript.Arguments(0)

Dim objShell, objFolder
Set objShell = CreateObject("Shell.Application")

' Use a simple InputBox fallback via FileOpenDialog through Excel/WScript isn't reliable
' Use the SAPI / MSComDlg approach via late binding
Dim strFiles
strFiles = ""

' Try MSComDlg.CommonDialog (Office)
On Error Resume Next
Dim dlg
Set dlg = CreateObject("MSComDlg.CommonDialog")
If Err.Number = 0 Then
  dlg.Filter = "Video & Audio Files|*.mp4;*.mov;*.mkv;*.avi;*.webm;*.wmv;*.mxf;*.m4v;*.flv;*.mp3;*.aac;*.wav;*.flac;*.m4a|All Files|*.*"
  dlg.FilterIndex = 1
  dlg.Flags = &H200 Or &H800 ' OFN_PATHMUSTEXIST | OFN_ALLOWMULTISELECT
  dlg.ShowOpen
  If dlg.FileName <> "" Then strFiles = dlg.FileName
Else
  Err.Clear
  ' Fallback: use InputBox to let user type/paste a path
  strFiles = InputBox("Enter the full path to your file:" & vbCrLf & "(Tip: hold Shift + right-click a file and choose 'Copy as path')", "Select File")
  If strFiles <> "" Then
    ' Strip surrounding quotes if pasted from explorer
    strFiles = Replace(strFiles, Chr(34), "")
  End If
End If
On Error GoTo 0

' Write result
Dim fso, f
Set fso = CreateObject("Scripting.FileSystemObject")
Set f = fso.CreateTextFile(outFile, True, False)
f.Write strFiles
f.Close
