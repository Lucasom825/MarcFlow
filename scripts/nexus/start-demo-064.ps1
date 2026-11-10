<#
NEXUS 064 — execute in Windows PowerShell from a local clone:
  powershell -ExecutionPolicy Bypass -File .\scripts\nexus\start-demo-064.ps1
Run again to restart without losing edits. -Stop preserves the private MySQL volume.
No merge, production deploy, WhatsApp pairing, or cloud resources are performed.
#>
param(
    [switch]$Stop,
    [switch]$Status
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$compose = Join-Path $PSScriptRoot "compose.demo-064.yml"
$envFile = Join-Path $repo ".env.nexus-demo"

function New-Secret([int]$bytesCount) {
    $bytes = New-Object byte[] $bytesCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop / Docker Compose não foi encontrado. Instale Docker antes de iniciar a demo."
}
$composeArgs = @("compose", "--env-file", $envFile, "-f", $compose)

if ($Stop -or $Status) {
    if (!(Test-Path $envFile)) {
        throw "Nenhuma demonstração local encontrada neste repositório."
    }
    if ($Stop) {
        & docker @composeArgs down
        if ($LASTEXITCODE -ne 0) { throw "Falha ao desligar a demo." }
        Write-Host "Demo desligada. O volume MySQL e os rascunhos foram preservados."
    } else {
        & docker @composeArgs ps
        if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar o status." }
    }
    exit 0
}

if (!(Test-Path $envFile)) {
    $mysqlPass = New-Secret 20
    $rootPass = New-Secret 24
    $authSecret = New-Secret 32
    $ownerPass = New-Secret 20
    $lines = @(
        "# Segredos locais da demonstração NEXUS, NÃO COMPARTILHAR, NÃO COMMITAR",
        "MYSQL_PASSWORD=$mysqlPass",
        "MYSQL_ROOT_PASSWORD=$rootPass",
        "AUTH_SECRET=$authSecret",
        "NEXUS_DEMO_PASSWORD=$ownerPass"
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envFile, ($lines -join "`n") + "`n", $encoding)
    Write-Host "Novo arquivo local de credenciais criado, excluído do Git e do Docker build."
} else {
    Write-Host "Credenciais existentes preservadas. Nenhum banco será recriado."
}

& docker @composeArgs up -d --build
if ($LASTEXITCODE -ne 0) {
    throw "Falha no Docker Compose. Consulte: docker compose --env-file .env.nexus-demo -f scripts/nexus/compose.demo-064.yml logs app"
}

Write-Host ""
Write-Host "NEXUS 064 — demo local iniciada no Docker."
Write-Host "URL: http://localhost:39164/auth/login?callbackUrl=%2Fdashboard%2Fflows%2Fnexus_demo_first_flow"
Write-Host "E-mail: demo@nexus.invalid"
$password = (Get-Content -Path $envFile | Where-Object { $_ -match '^NEXUS_DEMO_PASSWORD=' } | Select-Object -First 1) -replace '^NEXUS_DEMO_PASSWORD=', ''
Write-Host "Senha local (não compartilhe): $password"
Write-Host "O primeiro carregamento pode compilar a interface. Se necessário, veja docker compose logs."
Write-Host "Somente localhost. Sem WhatsApp e sem publicação. Rascunhos sobrevivem ao reinício."
Write-Host "Para desligar: powershell -File .\scripts\nexus\start-demo-064.ps1 -Stop"
