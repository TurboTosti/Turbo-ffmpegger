# pick_folder.ps1 — shows a modern IFileOpenDialog folder picker, writes path to a temp file
param([string]$OutFile)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport]
[Guid("42F85136-DB7E-439C-85F1-E4075D135FC8")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IFileDialog {
    [PreserveSig] int Show([In] IntPtr hwnd);
    void SetFileTypes([In] uint cFileTypes, [In] IntPtr rgFilterSpec);
    void SetFileTypeIndex([In] uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise([In, MarshalAs(UnmanagedType.Interface)] object pfde, out uint pdwCookie);
    void Unadvise([In] uint dwCookie);
    void SetOptions([In] uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder([In, MarshalAs(UnmanagedType.Interface)] object psi);
    void SetFolder([In, MarshalAs(UnmanagedType.Interface)] object psi);
    void GetFolder([MarshalAs(UnmanagedType.Interface)] out object ppsi);
    void GetCurrentSelection([MarshalAs(UnmanagedType.Interface)] out object ppsi);
    void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult([MarshalAs(UnmanagedType.Interface)] out object ppsi);
    void AddPlace([In, MarshalAs(UnmanagedType.Interface)] object psi, int fdap);
    void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close([MarshalAs(UnmanagedType.Error)] int hr);
    void SetClientGuid([In] ref Guid guid);
    void ClearClientData();
    void SetFilter([MarshalAs(UnmanagedType.Interface)] object pFilter);
}

[ComImport]
[Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IShellItem {
    void BindToHandler([In] IntPtr pbc, [In] ref Guid bhid, [In] ref Guid riid, out IntPtr ppv);
    void GetParent([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
    void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
    void GetAttributes([In] uint sfgaoMask, out uint psfgaoAttribs);
    void Compare([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, [In] uint hint, out int piOrder);
}

public class FileDialogHelper {
    private static readonly Guid CLSID_FileOpenDialog = new Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7");
    private const uint FOS_PICKFOLDERS    = 0x00000020;
    private const uint FOS_FORCEFILESYSTEM = 0x00000040;
    private const uint SIGDN_FILESYSPATH  = 0x80058000;

    public static string PickFolder(string title) {
        Type t = Type.GetTypeFromCLSID(CLSID_FileOpenDialog);
        IFileDialog dlg = (IFileDialog)Activator.CreateInstance(t);
        dlg.SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
        dlg.SetTitle(title);
        int hr = dlg.Show(IntPtr.Zero);
        if (hr != 0) return null;
        object item;
        dlg.GetResult(out item);
        IShellItem si = (IShellItem)item;
        string path;
        si.GetDisplayName(SIGDN_FILESYSPATH, out path);
        return path;
    }
}
"@ -Language CSharp

try {
    $path = [FileDialogHelper]::PickFolder("Choose output folder")
    if ($path) {
        $path.Trim() | Out-File -FilePath $OutFile -Encoding ASCII -NoNewline
    } else {
        "" | Out-File -FilePath $OutFile -Encoding ASCII -NoNewline
    }
} catch {
    # Fallback to classic FolderBrowserDialog
    Add-Type -AssemblyName System.Windows.Forms
    $fb = New-Object System.Windows.Forms.FolderBrowserDialog
    $fb.Description = "Choose output folder"
    $fb.ShowNewFolderButton = $true
    if ($fb.ShowDialog() -eq "OK") {
        $fb.SelectedPath.Trim() | Out-File -FilePath $OutFile -Encoding ASCII -NoNewline
    } else {
        "" | Out-File -FilePath $OutFile -Encoding ASCII -NoNewline
    }
}
