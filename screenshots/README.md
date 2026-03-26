# Screenshots - Testes com Playwright

Esta pasta contém screenshots de testes E2E com Playwright.

## Estrutura

```
screenshots/
├── [CARD_ID]-[FEATURE]/
│   ├── 01-initial-state.png
│   ├── 02-interaction.png
│   ├── 03-result.png
│   └── 04-final-state.png
└── README.md
```

## Regras

1. **Sempre criar subpasta** para cada card
2. **Numerar screenshots** sequencialmente (01, 02, 03...)
3. **Nomes descritivos** (ex: `03-upload-progress.png`)
4. **Incluir no report** com markdown: `![Descrição](screenshots/path/to/image.png)`

## Exemplo

```markdown
### Upload de Vídeo
![Upload Page](screenshots/1.5.2-video-upload/01-upload-page.png)
![Progress Bar](screenshots/1.5.2-video-upload/02-progress-bar.png)
![Upload Complete](screenshots/1.5.2-video-upload/03-upload-complete.png)
```

---

**Screenshots são obrigatórios em todos os testes!**
