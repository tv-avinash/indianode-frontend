# ----- Razorpay webhook manual test (payment.captured) -----
# Edit these:
$Secret      = "<YOUR_RAZORPAY_WEBHOOK_SECRET>"   # required
$Url         = "https://www.indianode.com/api/razorpay-webhook"
$Product     = "sd"                                # whisper | sd | llama
$Minutes     = 60
$AmountPaise = 20000                               # ₹200 = 20000
$Email       = "you@example.com"

# Generate fake ids
$PaymentId = "pay_test_{0}"   -f (Get-Random -Minimum 100000 -Maximum 999999)
$OrderId   = "order_test_{0}" -f (Get-Random -Minimum 100000 -Maximum 999999)

if ([string]::IsNullOrWhiteSpace($Secret)) { Write-Host "Set `$Secret first."; exit 1 }

# Build payload
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

# Compute HMAC-SHA256 over RAW body (fix: pass byte[] as single arg)
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$hmac     = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
$signature = -join ($sigBytes | ForEach-Object { $_.ToString("x2") })

$headers = @{ "X-Razorpay-Signature" = $signature }

Write-Host "POST $Url"
Write-Host "X-Razorpay-Signature: $signature"
Write-Host "Body:" $body
Write-Host "-------------------------------------------------------------"

try {
  $resp = Invoke-WebRequest -Method POST -Uri $Url -Headers $headers -ContentType "application/json" -Body $body -UseBasicParsing
  Write-Host "Status: $($resp.StatusCode) $($resp.StatusDescription)"
  Write-Host "Body  : $($resp.Content)"
} catch {
  if ($_.Exception.Response) {
    $r = $_.Exception.Response
    $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
    $txt = $sr.ReadToEnd()
    Write-Host "Status: $([int]$r.StatusCode) $([string]$r.StatusDescription)"
    Write-Host "Body  : $txt"
  } else {
    Write-Host "Error : $($_.Exception.Message)"
  }
}
# ----- end script -----
