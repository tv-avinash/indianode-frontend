# Compare server-expected signature, then verify webhook with it

$UrlWebhook = "https://www.indianode.com/api/razorpay-webhook"

# Build a test body (same shape Razorpay sends)
$Product     = "sd"
$Minutes     = 60
$AmountPaise = 20000
$Email       = "you@example.com"
$PaymentId   = ("pay_test_{0}"   -f (Get-Random -Minimum 100000 -Maximum 999999))
$OrderId     = ("order_test_{0}" -f (Get-Random -Minimum 100000 -Maximum 999999))

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

# (A) Ask the server what signature it EXPECTS for THIS exact body
$respDbg = Invoke-WebRequest -Method POST -Uri ($UrlWebhook + "?debug=1") -ContentType "application/json" -Body $body -UseBasicParsing
$serverJson = $respDbg.Content | ConvertFrom-Json
$serverSig  = $serverJson.expected
Write-Host ("Server expects: {0}" -f $serverSig)
Write-Host ("Body length   : {0}" -f $serverJson.rawLen)

# (B) Now post to the real webhook using the server's expected signature
$headers = @{ "X-Razorpay-Signature" = $serverSig }
$respWh  = Invoke-WebRequest -Method POST -Uri $UrlWebhook -Headers $headers -ContentType "application/json" -Body $body -UseBasicParsing
Write-Host ("Webhook status: {0} {1}" -f $respWh.StatusCode, $respWh.StatusDescription)
Write-Host ("Webhook body  : {0}" -f $respWh.Content)
