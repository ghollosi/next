# VSys Next - E2E Test Runner (Windows PowerShell)
# This script starts a test database, runs migrations, executes e2e tests, and cleans up.

param(
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  VSys Next - E2E Test Suite" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

function Cleanup {
    Write-Host "`nCleaning up test database..." -ForegroundColor Yellow
    docker compose -f docker-compose.test.yml down -v --remove-orphans 2>$null
}

# Register cleanup on exit
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

try {
    # Stop any existing test containers
    Write-Host "Stopping any existing test containers..." -ForegroundColor Yellow
    docker compose -f docker-compose.test.yml down -v --remove-orphans 2>$null

    # Start test database
    Write-Host "Starting test database..." -ForegroundColor Yellow
    docker compose -f docker-compose.test.yml up -d

    # Wait for database to be ready
    Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
    $retries = 30
    $ready = $false

    while ($retries -gt 0 -and -not $ready) {
        $result = docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U vsys_test -d vsys_next_test 2>$null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
        } else {
            Write-Host "  Waiting for postgres... ($retries attempts remaining)"
            Start-Sleep -Seconds 1
            $retries--
        }
    }

    if (-not $ready) {
        Write-Host "Database failed to start within timeout" -ForegroundColor Red
        exit 1
    }

    Write-Host "Database is ready!" -ForegroundColor Green

    # Set environment for tests
    $env:DATABASE_URL = "postgresql://vsys_test:vsys_test_password@localhost:5433/vsys_next_test?schema=public"
    $env:NODE_ENV = "test"

    # Run migrations
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed"
    }

    # Run e2e tests
    Write-Host "Running e2e tests..." -ForegroundColor Yellow
    Write-Host ""

    npx jest --config ./test/jest-e2e.json --forceExit --detectOpenHandles
    $testExitCode = $LASTEXITCODE

    Write-Host ""
    if ($testExitCode -eq 0) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  All E2E tests passed!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  E2E tests failed (exit code: $testExitCode)" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
    }

    exit $testExitCode
}
finally {
    if (-not $SkipCleanup) {
        Cleanup
    }
}
