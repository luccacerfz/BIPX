# BIPX — auditoria do candidato de 18/09/2026

**20/20 suítes passaram. Nota 10 em todos os critérios continua não estabelecida.** Nenhuma nota foi atribuída por esta auditoria. O JSON contém evidência para avaliação indireta pelo TypeSafe Jev (JEF), com cobertura parcial em todas as dimensões.

Baseline testada de 2026-09-18T18:06:31.749Z a 2026-09-18T18:10:48.220Z, sem mudança nos 101 arquivos monitorados. [Manifesto](../output/playwright/2026-09-18T18-06-31-749Z-quality-suite/suite.json), SHA-256 `c0f00947804d995c6b8fbda7ae7611937ef150febde7c553434c7e903b1b8892`. Main: `96f38650216d1aba6a6789edc31b3836da9d5e0d75c257fcc3f5a6b0c99a4408`. Escopo: aplicação, render/VFX/áudio/assets/vendor, HTML/CSS/servidor e pacotes; tooling de teste fora desse mapa. Alterações posteriores pertencem a outro candidato.

Comando: `BIPX_BROWSER_CHANNEL=chrome BIPX_HEADLESS=0 npm run verify:all`. Chrome 153.0.8010.48, WebGL2/ANGLE Metal Apple M5 Pro, servidor local isolado; Chrome do usuário aberto e pausado.

Passaram core, experiência, personagens, NPCs, pool, lifecycle, VFX, catálogo sintético, mobile emulado, dois grupos de desempenho, HTTP, protocolo multiplayer, classes, Orc, contrato do avaliador, multiplayer em dois navegadores, assets e dois grupos de áudio.

| Amostra sintética (~12 s) | Inimigos | Qualidade | FPS médio | p95 ms | Pior ms |
| --- | ---: | --- | ---: | ---: | ---: |
| Desktop wave 6 | 94 | high | 144 | 7.3 | 7.9 |
| Touch viewport wave 6 | 94 | medium | 143.6 | 7.7 | 41.6 |
| Desktop wave 16 | 362 | low | 143.9 | 7.5 | 14 |
| Touch viewport wave 16 | 362 | low | 143.9 | 7.5 | 13.9 |

Sem frame acima de 50 ms ou ameaça invisível nas amostras. Perfis touch rodam no Mac, não em telefone. Fixtures congelam combate e não provam desempenho em combate denso ativo; screenshots finais de desempenho são posteriores ao restart.

Aldric/espada e Lyra/rifle passaram seleção, persistência, input real, animação, dano e rejeição de ataques incompatíveis. Vinte trocas mantiveram 67 geometrias/27 texturas; três mortes/restarts, 68/28. Pool de corpos animados e cadáveres limitado a 20 desktop/10 touch. Dois clientes reais concordam no mundo; late join usa nova identidade, não retomada de conexão.

Catálogo sintético: 21 famílias VFX exercitadas, sem prova de disparo natural de todas. Áudio: 13 samples decodificados, PCM de 15.829 s com pico -7.926 dBFS; mute/pausa/espacialização/vozes passaram. Escuta ainda pendente.

Defeitos desta baseline:

- Rifle com colisão só no destino do frame: passo de 1,68 m pode atravessar runner de raio combinado 0,70 m. Achado de código; reprodução determinística pendente nesta baseline.
- [Horda sintética](../output/playwright/2026-09-18T18-06-31-749Z-quality-suite/verify-npcs/npc-desktop-bounded-horde.png) com proxies cilíndricos coloridos, silhuetas pretas e boss geométrico. Ícones legados do fixture não provam orbe no guerreiro natural.
- Landscape 874×402 com LVL 1 da espada parcialmente cortado.
- Canvas compacto mais suave que HUD; impacto físico ainda pendente.

Faltam aparelho físico, revisão temporal de arte/VFX, escuta, acessibilidade abrangente, soak e rede adversa. [Evidência JSON](quality-candidate-20260918.json) e [registro visual](quality-review.characters-current.json) preservam fontes e limitações.
