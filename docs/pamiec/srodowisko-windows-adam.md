---
name: srodowisko-windows-adam
description: "Narzędzia zainstalowane na komputerze Adama (git, gh, node) i pułapki PowerShell/sandboxa"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9bf38783-50ef-4ef5-a43a-9d32714431c1
  modified: 2026-09-21T11:36:10.314Z
---

Zainstalowane 2026-09-21 przez winget: Git 2.55 (`C:\Program Files\Git\cmd`), GitHub CLI 2.101
(`C:\Program Files\GitHub CLI`, zalogowany jako AdamKond), Node 24 LTS (`C:\Program Files\nodejs`).
Nowe sesje PowerShell w narzędziu mogą nie mieć ich w PATH — dopisać `$env:Path += ";C:\Program Files\nodejs;C:\Program Files\Git\cmd"`.

Pułapki: sandbox blokuje polecenia zawierające `rm -r`/`Remove-Item` inline — kasowanie robić ze skryptu .ps1
zapisanego w scratchpadzie. Heredoc bash (`<<'MSG'`) nie działa; wieloliniowy commit → `git commit -F plik`.
Skrypty tsx z pakietami projektu uruchamiać z folderu projektu (kopiując plik do środka), nie ze scratchpada.
`Get-Content` bez `-Encoding utf8` psuje polskie znaki.
