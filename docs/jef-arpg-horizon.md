# JEF real — Horizon integrado, HUD painted-v3, continuidade e SFX

Avaliado em 2026-09-19T01:46:13.778Z; TypeSafe Jev, modelo solicitado `jev-1.13.0`. **HTTP200 / `requires_further_work`**. Todas as12notas aceitas continuam `null`; alvo10/10 por dimensão inalterado, `fullGoalComplete:false`. Este checkpoint encerra a janela de arte integrada, não o goal AAA.

## Candidato e prova

[213hashes](../output/qa/arpg-horizon-integrated-20260919/source-manifest.json), [18relatórios fonte a fonte](../output/qa/arpg-horizon-integrated-20260919/evidence-provenance.json), [evidência enviada](../output/qa/arpg-horizon-integrated-20260919/evidence.json), [resposta real](../output/qa/arpg-horizon-integrated-20260919/jef.json) e [medições consolidadas](../output/qa/arpg-horizon-integrated-20260919/measurements.json). Todos os18relatórios completos coincidem com213fontes runtime/assets e ficaram estáveis durante as execuções. Evidência anterior dos donos é indicada como componente/histórica, não promovida a prova global desta fonte.

- CPU/protocolo13/13, runtime/ferramentas estáveis na suíte01:32.
- Depth9/9: passe único compartilhado1/4/8campos, zero invisível; alocação/ciclo de vida, pause/resize/reduced, restauração renderer inclusive exceção e paridade de descarte cutaway/clipping instanciado0mismatches em4casos65536pixels.
- SFX23/23 em dois clientes reais: desconexão interrompe loops sem falso colapso/replay; identidade/recurso/CD/sequence preservados. Hook CPU6/6, incluindo150frames suspensos.
- Combos3/3:2alvos vivos stun/3cortes letais; freeze/pull2high e3low/reduced.178/185frames com campo visível têm depth válido e1passe.
-12casts em4contextos parado/movimento. Rede6casts iguais, mundo compartilhado, movimento remoto/parada, reconnect e terceiro latejoin.
- Pós-colisão natural nas duas classes: parede/slide e dash/escudo bloqueados; idle ao parar, jitter Z0nos6samples finais. Não é aprovação de sola/no-slide.
- Natural60s/classe: Aldric142.1843FPS,p958.3ms,p998.7ms,pior48.6ms; Lyra140.9399FPS,p958.4ms,p9913.9ms,pior27.8ms. Zero frames>50ms/longtasks.1440×900 Chrome/Metal AppleM5Pro, GPU serializada. Gate>=57FPS/p95<=20ms mantido. Aldric24kills/nível3 e morte/restart; Lyra78kills/nível7/onda2.
- GPU timer separado, fixture1280×720,14casos24amostras úteis após6warmups,0disjoint. Depth mediana.498–.569ms; full pipeline high0/1/4/8campos p954.290/5.194/6.328/6.023ms, low3.359/4.516/6.636/7.249ms. Não confundir custo fixture com FPS/horda/mobile; ordem/DVFS explica não monotonicidade sem alegar custo negativo.

## Avaliação e limites

JEF recebeu **texto**, não PNG/WebM/WAV. Credencial somente no ambiente do subprocesso; histórico privado não enviado. [Inspeção Combat](../output/qa/arpg-horizon-integrated-20260919/native-observations.json) e [revisão independente Root](arpg/review/integrated-art-followup.md) entram como observações declaradas. A ferramenta não aceita entrada áudio; nenhuma escuta foi feita.

| Dimensão | Preliminar textual0–10 | Nota aceita |
| --- | ---: | --- |
| game_design | 5.37 | pendente / null |
| animation | 5.31 | pendente / null |
| art_direction | 5.13 | pendente / null |
| vfx | 5.98 | pendente / null |
| combat_feel | 5.84 | pendente / null |
| ui_ux | 6.07 | pendente / null |
| mobile | 1.54 | pendente / null |
| audio | 4.73 | pendente / null |
| performance | 6.33 | pendente / null |
| multiplayer | 5.01 | pendente / null |
| accessibility | 4.23 | pendente / null |
| reliability | 5.87 | pendente / null |

Horizon/nebula e ícones melhoraram; halo multicampo concentra brilho. Grito ainda fino/geométrico, canhão pequeno/periódico, corte difícil de distinguir na horda; gelo requer playback contínuo. `acceptedNoSliding:false`:07952bfc corrige o salto específico na soltura, não toda deriva/rápida ré/alcance/penetração. Cadáver tem duas peças rígidas, não ragdoll anatômico. Áudio sem aceite perceptual; dispositivos físicos, horda extrema/soak, acessibilidade e feel humano continuam pendentes.

Crowd runtime ainda admite compressão/deslocamento de controlados sob pressão/dt100ms; candidato Physics dinâmico/otimização estão isolados. Próxima janela será coordenada com o dono após este checkpoint; seus resultados não fazem parte deste JEF. Canhão orgânico, ré rápida e Lich permanecem staging.

## Histórico preservado

Suíte00:39permaneceFAILED12/13, HP200vs160 antes de recebimentoWebSocket. Harness corrigido espera160nos dois canais sem reduzir testes de autoridade; atual13/13é execução nova. Horizon01:21falhou gate torso28.10%<65%; refino/fonte final01:26passou com mínimo87.603%, limiar inalterado. Mão suspensa corpsev3 e reparo localizado continuam registrados. Reprodução de loop14.2s e patch SFX preservados; atual23/23comprova correção limitada. Nenhum artefato rejeitado foi apagado ou renomeado como sucesso.

Servidor local5173/PID97873 preservado, Supabase desligado, ranking local íntegro. Nenhum commit/push/deploy.
