# ----- compare local vs server expected, then post -----
$UrlWebhook = "https://www.indianode.com/api/razorpay-webhook"
$UrlDebug   = "https://www.indianode.com/api/_debug-compute-sig"

# Edit these if you want
$Product     = "sd"
$Minutes     = 60
$AmountPaise = 20000
$Email       = "you@example.com"

# Fake ids
$PaymentId = "pay_test_{0}"   -f (Get-Random -Minimum 100000 -Maximum 999999)
$OrderId   = "order_test_{0}" -f (Get-Random -Minimum 100000 -Maximum 999999)

# Build JSON body identical to Razorpay structure
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

# (A) Compute local signature with YOUR secret (optional; for comparison)
# Put your secret here ONLY if you want to compare:
$Secret = "<YOUR_RAZORPAY_WEBHOOK_SECRET_OR_LEAVE_EMPTY>"
$localSig = ""
if (-not [string]::IsNullOrWhiteSpace($Secret)) {
  $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
  $hmac     = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
  $sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
  $localSig = -join ($sigBytes | ForEach-Object { $_.ToString("x2") })
}

# (B) Ask the server what it expects for THIS body
$respDbg = Invoke-WebRequest -Method POST -Uri $UrlDebug -ContentType "application/json" -Body $body -UseBasicParsing
$serverJson = $respDbg.Content | ConvertFrom-Json
$serverSig  = $serverJson.expected

Write-Host "Local  signature: $localSig"
Write-Host "Server signature: $serverSig"
Write-Host "Body length     : $($serverJson.rawLen)"
Write-Host "-------------------------------------------------------------"

# (C) Now post to the real webhook using the server's expected signature
$headers = @{ "X-Razorpay-Signature" = $serverSig }
$respWh  = Invoke-WebRequest -Method POST -Uri $UrlWebhook -Headers $headers -ContentType "application/json" -Body $body -UseBasicParsing
Write-Host "Webhook status  : $($respWh.StatusCode) $($respWh.StatusDescription)"
Write-Host "Webhook body    : $($respWh.Content)"
# ----- end -----
