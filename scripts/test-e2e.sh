#!/bin/bash
# VSys Next - E2E Test Runner (macOS/Linux)
# This script starts a test database, runs migrations, executes e2e tests, and cleans up.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  VSys Next - E2E Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test database...${NC}"
    docker compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
}

# Trap EXIT to ensure cleanup runs
trap cleanup EXIT

# Stop any existing test containers
echo -e "${YELLOW}Stopping any existing test containers...${NC}"
docker compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true

# Start test database
echo -e "${YELLOW}Starting test database...${NC}"
docker compose -f docker-compose.test.yml up -d

# Wait for database to be ready
echo -e "${YELLOW}Waiting for database to be ready...${NC}"
RETRIES=30
until docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U vsys_test -d vsys_next_test > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo -e "${RED}Database failed to start within timeout${NC}"
        exit 1
    fi
    echo "  Waiting for postgres... ($RETRIES attempts remaining)"
    sleep 1
done

echo -e "${GREEN}Database is ready!${NC}"

# Set environment for tests
export DATABASE_URL="postgresql://vsys_test:vsys_test_password@localhost:5433/vsys_next_test?schema=public"
export NODE_ENV="test"

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
npx prisma migrate deploy

# Run e2e tests
echo -e "${YELLOW}Running e2e tests...${NC}"
echo ""

TEST_EXIT_CODE=0
npx jest --config ./test/jest-e2e.json --forceExit --detectOpenHandles || TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All E2E tests passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  E2E tests failed (exit code: $TEST_EXIT_CODE)${NC}"
    echo -e "${RED}========================================${NC}"
fi

exit $TEST_EXIT_CODE
