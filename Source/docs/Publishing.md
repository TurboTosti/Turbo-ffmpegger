# Publish v1.0-alpha on GitHub

## Copy into your existing Git folder

Extract the preparation ZIP. Its contents are already at repository level;
there is no extra enclosing project folder. Copy `README.md`, `.gitignore`,
`Source`, `Docs`, `Windows` and `Linux` into the folder containing your `.git`
directory. Keep that existing `.git` directory. The preparation ZIP contains
no `.git` directory, conversion programs, personal settings or game saves.

If you have your own `.gitignore`, merge its rules with the supplied rules.
Commit and push Source, Docs, README and the ignore rules. Do not commit the
large release ZIPs: Windows/*.zip and Linux/*.zip are deliberately ignored.
If an old executable or archive is already tracked by Git, ignore rules do
not untrack it; remove that obsolete tracked copy from the commit yourself.

The conversion programs `ffmpeg.exe`, `ffprobe.exe`, `ffmpeg` and `ffprobe`
are excluded from all packages and ignored by exact filename. Electron's
required ffmpeg.dll/libffmpeg.so runtime libraries remain in the platform ZIPs.

## Attach the application downloads

1. Open **TurboTosti/Turbo-ffmpegger** on GitHub.
2. Choose **Releases > Draft a new release**.
3. Use tag **v1.0-alpha** and target the branch with this source commit.
4. Use title **Turbo ffmpegger 1.0 alpha** and the text in Release-notes.md.
5. Attach these two files, unchanged, from the preparation bundle:
   `Windows/Turbo-ffmpegger-1.0.0-alpha-Windows-x64.zip` and
   `Linux/Turbo-ffmpegger-1.0.0-alpha-Linux-x64.zip`.
6. Select **This is a pre-release**, finish attaching both files, then publish.

Do not attach the outer preparation ZIP as an update asset. Users download
their platform ZIP, extract it, then add their own conversion programs as
explained in README and FFmpeg-setup.md. GitHub's source downloads provide the
committed Source folder; no separate source attachment is required by the
updater. Keep license notices with any components you redistribute.

The updater reads published releases in this exact repository. It ignores
drafts, source assets and equal/older versions. It chooses the x64 ZIP for the
running platform and validates the embedded version, platform and file hashes.
Source repository layout does not determine update availability.

Use these newly prepared packages, not the earlier same-version archives
that contained conversion tools. Local alpha.1/alpha.2 and private 2.0.x
checkpoints need a manual installation because they consider this version
older. Automatic upgrades from original 0.8 have not been verified.

## Future releases

Choose a higher version, for example tag `v1.1-alpha` with package version
`1.1.0-alpha`. Update Source/app/package.json, rebuild the launchers and
packages as described in Source/README.md, and publish a new release with the
two matching ZIPs. Renaming a ZIP or changing just the GitHub tag is not enough.
Changing the repository owner/name also requires changing the updater's REPO
constant and distributing that configuration before relying on the new URL.

The packaging scripts never copy locally installed conversion programs.
Keep them outside the public source and do not manually add them to ZIPs.

GitHub documentation:
- [Create a release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Large files and release downloads](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
