#!/bin/bash

# Script de teste para o sistema de audit logging

echo "🧪 Testando Sistema de Audit Logging"
echo "======================================"
echo ""

# Configuração
API_URL="https://framevideos.com/api/v1"
# API_URL="http://localhost:8787/api/v1" # Para testes locais

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local token=$5
  
  echo -e "${YELLOW}Testando: $name${NC}"
  
  if [ -z "$token" ]; then
    response=$(curl -s -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      ${data:+-d "$data"})
  else
    response=$(curl -s -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      ${data:+-d "$data"})
  fi
  
  echo "Response: $response"
  echo ""
}

# 1. Registrar usuário (gera evento de auditoria)
echo "1️⃣ Registrando usuário..."
REGISTER_DATA='{
  "email": "audit-test-'$(date +%s)'@example.com",
  "password": "Test@123456",
  "name": "Audit Test User",
  "acceptTerms": true,
  "acceptPrivacy": true
}'

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_DATA")

echo "Response: $REGISTER_RESPONSE"
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Falha ao obter token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Token obtido: ${TOKEN:0:20}...${NC}"
echo ""

# 2. Fazer login (gera evento de auditoria)
echo "2️⃣ Fazendo login..."
EMAIL=$(echo $REGISTER_DATA | grep -o '"email":"[^"]*' | cut -d'"' -f4)
LOGIN_DATA='{
  "email": "'$EMAIL'",
  "password": "Test@123456"
}'

test_endpoint "Login" "POST" "/auth/login" "$LOGIN_DATA"

# 3. Tentar fazer login com senha errada (gera evento de falha)
echo "3️⃣ Tentando login com senha errada..."
WRONG_LOGIN_DATA='{
  "email": "'$EMAIL'",
  "password": "WrongPassword123"
}'

test_endpoint "Login Falho" "POST" "/auth/login" "$WRONG_LOGIN_DATA"

echo ""
echo "======================================"
echo "✅ Testes de geração de eventos concluídos!"
echo ""
echo "Para visualizar os logs de auditoria:"
echo "1. Faça login como super_admin"
echo "2. Acesse: GET $API_URL/audit/logs"
echo "3. Ou veja estatísticas: GET $API_URL/audit/stats"
echo ""
echo "Filtros disponíveis:"
echo "  - event_type: login_success, login_failed, register_success, etc."
echo "  - user_id: ID do usuário"
echo "  - tenant_id: ID do tenant"
echo "  - start_date: Data inicial (ISO 8601)"
echo "  - end_date: Data final (ISO 8601)"
echo "  - limit: Número de resultados (padrão: 100)"
echo "  - offset: Offset para paginação"
echo ""
