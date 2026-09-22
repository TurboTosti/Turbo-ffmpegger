// Tiny native launcher. Imports only Windows APIs; no C/.NET runtime is needed.
#define UNICODE
#define _UNICODE
#include <windows.h>

static WCHAR module[32768], child[32768], command[32768];
static STARTUPINFOW startup;
static PROCESS_INFORMATION process;

static void fail(DWORD code) {
    const char message[] = "Turbo ffmpegger could not start. Extract the complete portable folder, including App, and try again.\r\n";
    HANDLE err = GetStdHandle(STD_ERROR_HANDLE);
    if (err && err != INVALID_HANDLE_VALUE) {
        DWORD written;
        WriteFile(err, message, sizeof(message)-1, &written, NULL);
    } else {
        MessageBoxW(NULL, L"Turbo ffmpegger could not start.\n\nExtract the complete portable folder, including the App folder, and try again.", L"Turbo ffmpegger", MB_OK | MB_ICONERROR);
    }
    ExitProcess(code ? code : 1);
}

void mainCRTStartup(void) {
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
    DWORD n = GetModuleFileNameW(NULL, module, 32768);
    if (!n || n >= 32768) fail(ERROR_FILENAME_EXCED_RANGE);
    while (n && module[n-1] != L'\\') --n;
    if (!n) fail(ERROR_PATH_NOT_FOUND);
    const WCHAR suffix[] = L"App\\Turbo ffmpegger.exe";
    DWORD length = n;
    for (DWORD i=0; i<n; ++i) child[i] = module[i];
    for (DWORD i=0; suffix[i]; ++i) {
        if (length >= 32766) fail(ERROR_FILENAME_EXCED_RANGE);
        child[length++] = suffix[i];
    }
    child[length] = 0;
    if (length > 32764) fail(ERROR_FILENAME_EXCED_RANGE);

    // Keep the caller's argument tail verbatim, including Unicode and quoting.
    WCHAR *tail = GetCommandLineW();
    if (*tail == L'"') { ++tail; while (*tail && *tail != L'"') ++tail; if (*tail) ++tail; }
    else { while (*tail && *tail != L' ' && *tail != L'\t') ++tail; }
    DWORD pos=0;
    command[pos++] = L'"';
    for (DWORD i=0; i<length; ++i) command[pos++] = child[i];
    command[pos++] = L'"';
    while (*tail) { if (pos >= 32766) fail(ERROR_FILENAME_EXCED_RANGE); command[pos++] = *tail++; }
    command[pos] = 0;
    // Child DLLs resolve within App. Data location is derived by the application.
    module[n++] = L'A'; module[n++] = L'p'; module[n++] = L'p'; module[n] = 0;
    startup.cb = sizeof(startup);
    HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE), err = GetStdHandle(STD_ERROR_HANDLE);
    BOOL inherit = (out && out != INVALID_HANDLE_VALUE) || (err && err != INVALID_HANDLE_VALUE);
    if (inherit) {
        startup.dwFlags = STARTF_USESTDHANDLES;
        startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
        startup.hStdOutput = out; startup.hStdError = err;
    }
    if (!CreateProcessW(child, command, NULL, NULL, inherit, 0, NULL, module, &startup, &process)) fail(GetLastError());
    CloseHandle(process.hThread);
    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD code=1;
    GetExitCodeProcess(process.hProcess, &code);
    CloseHandle(process.hProcess);
    ExitProcess(code);
}
