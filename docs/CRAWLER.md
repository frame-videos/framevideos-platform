# Crawler Engine — Frame Videos

## Arquitetura

O crawler é um sistema de importação automática de vídeos de sites externos, integrado ao ecossistema Frame Videos.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Tenant Admin │────▶│  API Routes  │────▶│   Crawler   │
│  (React UI)  │     │  /crawler/*  │     │   Service   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌────────────────────────────┼────────────────────┐
                    │                            │                    │
                    ▼                            ▼                    ▼
            ┌──────────────┐           ┌──────────────┐     ┌──────────────┐
            │  fetch(url)  │           │  D1 Database │     │  LLM API     │
            │  Parse HTML  │           │  (videos,    │     │  (enrichment │
            │  Extract     │           │   runs,      │     │   opcional)  │
            │  links       │           │   sources)   │     └──────────────┘
            └──────────────┘           └──────────────┘
```

### Componentes

- **Routes** (`src/routes/crawler.ts`): CRUD de sources + execução + histórico
- **Service** (`src/services/crawler.ts`): Core logic de crawling
- **Migration** (`007_crawler.sql`): Tabelas `crawler_sources` e `crawler_runs`
- **UI** (`src/pages/Crawler.tsx`): Interface de gerenciamento no admin

### Fluxo de Execução

1. Usuário configura uma **source** (URL + seletores CSS)
2. Ao executar (manual ou agendado):
   - Fetch da URL com User-Agent customizado
   - Parse do HTML com regex (sem DOM parser — Workers limitation)
   - Extração de links, títulos, thumbnails, duração
   - Deduplicação por `source_url` na tabela `videos`
   - Criação de vídeos novos com status `draft`
   - Enriquecimento com IA (opcional, consome créditos)
3. Resultado registrado em `crawler_runs`

## Configuração de Sources

Cada source precisa de:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome identificador |
| `url` | string | URL da página a ser crawleada |
| `selectors` | object | Seletores CSS (ver abaixo) |
| `schedule` | enum | `manual`, `daily`, `weekly` |
| `active` | boolean | Se a source está ativa |

### Exemplo de Source

```json
{
  "name": "Example Site - Popular",
  "url": "https://example.com/popular",
  "selectors": {
    "videoLink": ".video-card",
    "title": "h3.title",
    "thumbnail": "img.thumb",
    "duration": "span.duration"
  },
  "schedule": "daily",
  "active": true
}
```

## Seletores CSS

O crawler converte seletores CSS simples em regex patterns para parsing de HTML.

### Seletores Suportados

| Padrão | Exemplo | Descrição |
|--------|---------|-----------|
| `tag` | `div` | Qualquer tag |
| `.class` | `.video-card` | Qualquer tag com a classe |
| `tag.class` | `a.video-link` | Tag específica com classe |
| `#id` | `#player` | Tag com ID |
| `tag[attr="val"]` | `a[data-type="video"]` | Tag com atributo específico |

### Limitações

- **Sem DOM parser**: Workers não suportam `DOMParser` ou `cheerio` nativamente
- **Regex-based**: Funciona bem para HTML bem-formado, pode falhar em edge cases
- **Sem seletores compostos**: Não suporta `div > a.link` ou `div a`
- **Sem pseudo-classes**: Não suporta `:first-child`, `:nth-of-type`, etc.

### Dicas

1. Use seletores simples e específicos
2. O seletor `videoLink` deve apontar para o container que contém o link, título e thumbnail
3. Teste com poucas páginas antes de agendar crawls diários
4. Verifique o robots.txt do site-alvo

## Enriquecimento com IA

Quando o tenant tem créditos LLM disponíveis (≥ 7), o crawler pode enriquecer automaticamente:

| Operação | Créditos | Descrição |
|----------|----------|-----------|
| Gerar título SEO | 2 | Título otimizado para buscadores |
| Gerar descrição | 3 | Descrição de 2-3 frases |
| Gerar tags | 2 | 5-10 tags relevantes |

**Total por vídeo**: 7 créditos (se enriquecimento ativo)

O enriquecimento é **opcional** — se não houver créditos, o vídeo é criado com os dados extraídos do crawl.

## Agendamento

| Schedule | Comportamento |
|----------|---------------|
| `manual` | Executado apenas via botão "Executar Agora" |
| `daily` | Executado automaticamente a cada 24h (via Cron Trigger) |
| `weekly` | Executado automaticamente a cada 7 dias |

> **Nota**: O agendamento automático (`daily`/`weekly`) requer configuração de Cron Triggers no Worker. Na versão atual, apenas execução manual está implementada.

## Troubleshooting

### Crawl retorna 0 vídeos

1. Verifique se a URL está acessível (teste no browser)
2. Verifique se os seletores CSS estão corretos
3. Alguns sites bloqueiam crawlers — verifique o User-Agent
4. O site pode usar JavaScript para renderizar conteúdo (não suportado)

### Muitos duplicados

- O crawler deduplica por `source_url` — se a URL do vídeo mudou, será considerado novo
- Verifique se a URL base está correta

### Erros de fetch

- `HTTP 403`: Site bloqueou o crawler
- `HTTP 429`: Rate limit do site — reduza a frequência
- `Fetch failed`: URL inválida ou site offline

### AI enrichment falhou

- Verifique se há créditos suficientes (≥ 7)
- Verifique se as credenciais LLM estão configuradas
- O enriquecimento falha silenciosamente — o vídeo é criado sem dados AI

### Performance

- Cada crawl executa sincronamente (fetch → parse → insert)
- Para sites grandes, considere usar paginação na URL
- O timeout do Worker é de 30s — sites lentos podem causar timeout
