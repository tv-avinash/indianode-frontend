# Compare server-expected signature, then verify webhook with it (ASCII-only)

$UrlWebhook = "https://www.indianode.com/api/razorpay-webhook"

# Build the same test body as before
$Product     = "sd"
$Minutes     = 60
$AmountPaise = 20000
$Email       = "you@example.com"

# Fake ids
$PaymentId = ("pay_test_{0}" -f (Get-Random -Minimum 100000 -Maximum 999999))
$OrderId   = ("order_test_{0}" -f (Get-Random -Minimum 100000 -Maximum 999999))

$payload = [ordered]@{
  event   = "payment.captured"
  payload = @{
    payment = @{
      entity = @{
        id       = $PaymentId
        order_id = $OrderId
        amount   = $AmountPaise
        notes    = @{
          product   = $Product
          minutes   = "$Minutes"
          userEmail = $Email
        }
      }
    }
  }
}

$body = ($payload | ConvertTo-Json -Depth 10 -Compress)

# (A) Ask the server what signature it expects for THIS exact body
try {
  $respDbg = Invoke-WebRequest -Method POST -Uri ($UrlWebhook + "?debug=1") -ContentType "application/json" -Body $body -UseBasicParsing
  $serverJson = $respDbg.Content | ConvertFrom-Json
  $serverSig  = $serverJson.expected
  Write-Host ("Server expects: {0}" -f $serverSig)
  Write-Host ("Body length   : {0}" -f $serverJson.rawLen)
} catch {
  Write-Host "Debug call failed:" $_.Exception.Message -ForegroundColor Red
  if ($_.Exception.Response) {
    $r = $_.Exception.Response
    $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
    Write-Host ("Status: {0} {1}" -f ([int]$r.StatusCode), ([string]$r.StatusDescription))
    Write-Host ("Body  : {0}" -f ($sr.ReadToEnd()))
  }
  exit 1
}

# (B) Post to the real webhook using the server's expected signature
try {
  $headers = @{ "X-Razorpay-Signature" = $serverSig }
  $respWh  = Invoke-WebRequest -Method POST -Uri $UrlWebhook -Headers $headers -ContentType "application/json" -Body $body -UseBasicParsing
  Write-Host ("Webhook status: {0} {1}" -f $respWh.StatusCode, $respWh.StatusDescription)
  Write-Host ("Webhook body  : {0}" -f $respWh.Content)
} catch {
  Write-Host "Webhook call failed:" $_.Exception.Message -ForegroundColor Red
  if ($_.Exception.Response) {
    $r = $_.Exception.Response
    $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
    Write-Host ("Status: {0} {1}" -f ([int]$r.StatusCode), ([string]$r.StatusDescription))
    Write-Host ("Body  : {0}" -f ($sr.ReadToEnd()))
  }
  exit 1
}
