# Start Vite dev server in background
Write-Host "Starting Vite..." -ForegroundColor Cyan
$vite = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Normal

# Wait for Vite to be ready
Write-Host "Waiting for Vite on port 5174..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5174" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Write-Host "  Waiting... ($i/30)" -ForegroundColor DarkGray
}

if ($ready) {
    Write-Host "Vite is ready! Starting Electron..." -ForegroundColor Green
    npx electron .
} else {
    Write-Host "Vite did not start in time. Try running 'npm run dev' first." -ForegroundColor Red
}
