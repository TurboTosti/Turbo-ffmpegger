#define _GNU_SOURCE
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <limits.h>

// Static musl launcher: no additional runtime installation or shell parsing.
int main(int argc, char **argv) {
    char app[PATH_MAX];
    ssize_t n=readlink("/proc/self/exe", app, sizeof(app)-1);
    if(n<0 || n>=(ssize_t)sizeof(app)-1) { perror("Cannot locate Turbo ffmpegger"); return 1; }
    app[n]=0;
    char *slash=strrchr(app,'/');
    const char suffix[]="/App/turbo-ffmpegger";
    if(!slash || (size_t)(slash-app)+sizeof(suffix)>sizeof(app)) return 1;
    strcpy(slash,suffix);
    argv[0]=app;
    execv(app,argv);
    perror("Cannot start Turbo ffmpegger; extract the complete App folder");
    return 1;
}
