$BaseUrl = "https://chatbotamarte-production.up.railway.app"

Write-Host "Verificando $BaseUrl ..."

try {
  $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 20
  Write-Host "[OK] /health" -ForegroundColor Green
  $health | ConvertTo-Json -Compress
  if (-not $health.chatHistoryEnabled) {
    Write-Host "[FAIL] chatHistoryEnabled=false (el chat olvidará el contexto)" -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] chatHistoryEnabled=true" -ForegroundColor Green
  if (-not $health.supabasePersistenceEnabled) {
    Write-Host "[WARN] supabasePersistenceEnabled=false — historial solo en memoria del proceso" -ForegroundColor Yellow
    if ($health.chatHistoryInitError) {
      Write-Host "       initError: $($health.chatHistoryInitError)" -ForegroundColor Yellow
    }
  } else {
    Write-Host "[OK] supabasePersistenceEnabled=true" -ForegroundColor Green
  }
} catch {
  Write-Host "[FAIL] /health -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

try {
  $widget = Invoke-WebRequest -Uri "$BaseUrl/amarte-widget.js" -UseBasicParsing -TimeoutSec 20
  Write-Host "[OK] /amarte-widget.js ($($widget.RawContentLength) bytes)" -ForegroundColor Green
  if ($widget.Content -match "isWompiCheckoutLabel") {
    Write-Host "[OK] Fix Wompi presente en widget" -ForegroundColor Green
  } else {
    Write-Host "[WARN] Fix Wompi NO encontrado en widget desplegado" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[FAIL] /amarte-widget.js -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$body = @{
  message = "enlace de pago"
  roomName = "verify-script"
  pageUrl = "https://amartesuite.com/suites/"
  conversationId = "00000000-0000-4000-8000-000000000099"
} | ConvertTo-Json

try {
  $chat = Invoke-RestMethod -Uri "$BaseUrl/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
  Write-Host "[OK] /chat respondió" -ForegroundColor Green
  Write-Host $chat.reply
  if ($chat.reply -match "%3Cem%3E|<em>") {
    Write-Host "[FAIL] Enlace de pago corrupto en reply" -ForegroundColor Red
    exit 1
  }
  if ($chat.reply -notmatch "VPOS_RXJqnz") {
    Write-Host "[WARN] Reply no contiene URL Wompi esperada" -ForegroundColor Yellow
  } else {
    Write-Host "[OK] URL Wompi correcta en reply" -ForegroundColor Green
  }
} catch {
  Write-Host "[FAIL] /chat -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "Verificación completada." -ForegroundColor Green
