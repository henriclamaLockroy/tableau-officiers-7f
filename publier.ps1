# Publication du Tableau des Officiers
# 1. met a jour le numero anti-cache (?v=...) dans index.html et la version affichee dans app.js
# 2. envoie le code sur GitHub (GitHub Pages met le site a jour en ~1 minute)
# 3. depose une copie complete dans le dossier partage (assurance-vie : code + notice a cote des sauvegardes)
#
# Prerequis (une fois) : git installe et connecte au depot (etape 2 du plan), $DossierPartage renseigne.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ===== A COMPLETER (une fois) =====
$DossierPartage = ''   # ex. 'C:\Users\Henri\OneDrive\Tableau des Officiers\code' ('' = pas de copie)
# ==================================

$fichiers = @('index.html','app.js','archive.js','style.css','favicon.png','LISEZMOI.txt','EN-CAS-DE-PROBLEME.txt')

# 1. numero anti-cache = date + heure de publication
$v = Get-Date -Format 'yyyyMMddHHmm'
$build = Get-Date -Format 'yyyy-MM-dd'
$html = [IO.File]::ReadAllText("$PSScriptRoot\index.html", [Text.Encoding]::UTF8)
$html = $html -replace '\?v=\d+', "?v=$v"
[IO.File]::WriteAllText("$PSScriptRoot\index.html", $html, (New-Object Text.UTF8Encoding($false)))
$js = [IO.File]::ReadAllText("$PSScriptRoot\app.js", [Text.Encoding]::UTF8)
$js = $js -replace "const APP_BUILD = '[^']*'", "const APP_BUILD = '$build'"
[IO.File]::WriteAllText("$PSScriptRoot\app.js", $js, (New-Object Text.UTF8Encoding($false)))
Write-Host "Version anti-cache : $v"

# 2. envoi sur GitHub
if (Test-Path "$PSScriptRoot\.git") {
    git add -A
    git commit -m "Publication du $build" --allow-empty
    git push
    Write-Host "Envoye sur GitHub - le site sera a jour dans une minute environ."
} else {
    Write-Host "ATTENTION : depot git non initialise (etape 2 du plan) - rien n'a ete envoye en ligne." -ForegroundColor Yellow
}

# 3. copie dans le dossier partage
if ($DossierPartage -ne '') {
    New-Item -ItemType Directory -Force $DossierPartage | Out-Null
    foreach ($f in $fichiers) { if (Test-Path "$PSScriptRoot\$f") { Copy-Item "$PSScriptRoot\$f" $DossierPartage -Force } }
    Write-Host "Copie deposee dans : $DossierPartage"
} else {
    Write-Host "ATTENTION : `$DossierPartage non renseigne dans publier.ps1 - pas de copie de secours." -ForegroundColor Yellow
}
Write-Host "Termine." -ForegroundColor Green
