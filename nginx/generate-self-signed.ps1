param(
    [string]$CertDir = "$PSScriptRoot\certs",
    [string]$HostName = "localhost"
)

if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
}

$certPath = Join-Path $CertDir "$HostName.pfx"
$cert = New-SelfSignedCertificate -DnsName $HostName -CertStoreLocation "Cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(10)

# Export PFX and PEM
$securePassword = ConvertTo-SecureString -String "changeme" -Force -AsPlainText
Export-PfxCertificate -Cert "Cert:\LocalMachine\My\$($cert.Thumbprint)" -FilePath $certPath -Password $securePassword

# Extract PEM cert and key using openssl (requires openssl in PATH)
try {
    & openssl pkcs12 -in $certPath -nocerts -nodes -passin pass:changeme | Out-File -Encoding ascii (Join-Path $CertDir "privkey.pem")
    & openssl pkcs12 -in $certPath -clcerts -nokeys -passin pass:changeme | Out-File -Encoding ascii (Join-Path $CertDir "fullchain.pem")
    Write-Host "Generated self-signed certs in $CertDir"
} catch {
    Write-Warning "OpenSSL not available: exported PFX to $certPath. Install openssl to extract PEM files or use the PFX file directly." 
}
