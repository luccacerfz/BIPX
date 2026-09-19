# Brute v4 — revisão bounded concluída, candidato não aprovado

**GPU liberada03:58:46UTC; nenhuma próxima captura Brute prevista. GUI compact focal é a próxima por ordem Root.** Browser/servidor efêmeros próprios encerrados e token removido. Checagem04:01:22: lock ausente e nenhum processo Node GPU correspondente. [Liberação](../../output/brute-motion-v4/gpu-release.json), [sinais/fila](../../output/brute-motion-v4/gpu-window.json). GUI avisada viaqueue; Combat não recebeu pela fila cheia100 (uma tentativa, sem retry), aviso entregue neste handoff. [Recibos](../../output/brute-motion-v4/coordination-receipts.json).

**Decisão artística desta frente: não promover frontal71db9823.** Ele melhora a preparação comparado ao Swipe, porém ainda entra numa base agachada, fecha/torce o torso no seguimento e retorna ao Idle com grande mudança de altura. O gesto não satisfaz o ataque pesado em pé solicitado. Swipe continua rejeitado; os dois permanecem preservados. **A substituição aprovada do Brute v3 continua pendente**, embora este estudo bounded de dois takes esteja concluído. Nenhum terceiro take, nova matriz, nova GPU ou promoção automática nesta frente.

Ownership exclusivamente `output/brute-motion-v4/`, `tools/brute-motion-review*` e este documento. Animation avisado; heróis/Walker/áudio/Lich congelado, originais e/tmp preservados. Nada escrito em main/server/monster-library/GLBs runtime, nenhum restart5173. Perfil/dano/cooldown permanecem inalterados.

## Prova nativa e julgamento

[Report nativo](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/report.json), [revisão com hashes](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/artistic-review.json), [WebM original10.6s](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/video/page@f471c94d98a5142d6d516ee0e591efc0.webm). Chrome nativo/ANGLE Metal Apple M5 Pro,1440×900, zero page/console/HTTP/GL erros, hashes antes/depois idênticos. Aquisição `mkdir` atômica após autorização publicada Combat+Environment e precedência cedida por VFX. Sinal adicional Root chegou depois da captura; registrado sem retroagir timestamps ou repetir a rodada.

Quatro playbacks RAF reais: caller**.55s primeiro** e fonte**2.5s separadamente**, nas vistas3/4 eARPG. Cada caller contém33frames Attack; cada fonte150. Recovery aparece.5631/.5638s no caller e2.5028/2.5059s na fonte, primeiro frame disponível após o limite. Relógio não foi desacelerado para apresentar peso. Perfil fonte2.5/.55=**4.54545×**.

Inspecionados14PNG originais de poses amostradas e52quadros do WebM em quatro folhas. **Os PNGs posados não são playback; as folhas são amostras do playback real gravado, não revisão perceptual contínua.** Fixture isolada, sem gameplay/alvo/contato/rede. A rejeição se apoia na postura e transições observáveis, não em uma nota de fluidez inventada.

| Evidência | Conclusão local |
|---|---|
| [3/4 tempo caller](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/playback-close-caller-sheet.png) | Idle em pé→agachamento abrupto; torso dobra/torce no golpe e recupera altura rápido. Não transmite a base pesada estável pedida. |
| [3/4 duração fonte](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/playback-close-source-sheet.png) | Antecipação mais fácil de ler, mas base baixa e fechamento do torso persistem; desacelerar não resolve a atuação. |
| [ARPG caller](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/playback-arpg-caller-sheet.png) | Mudança global da silhueta domina a leitura; o impacto da mão não fica inequívoco. |
| [Marker exato](../../output/brute-motion-v4/native-2026-09-19T03-58-17-886Z/threequarter-marker.png) | R_Hand em.227333s é alcance visual proposto, sem contato confirmado. Autoridade aplica dano em0s: **desalinhamento aberto para Combat**. |

Telemetria nativa: quadril Idle1.746m→mínimo~.929m; maior salto entre frames~.274/.275m no caller (fonte~.203m). Essas medidas apoiam o problema visível de entrada, sem substituir julgamento de peso. Malha/skin/materiais e outros clips continuam preservados; isso não aprova deformação artística extrema. Gate geométrico diagnóstico12mm dos probes também permanece reprovado (máximo16.76mm CPU).

A fixture carrega pelo **GLTFLoader real**, consome os **probes originais** e reproduz normalização Idle3.3m/ground do loader, com adapter explícito do Attack inteiro. **Não executa o controller completo de monster-library/main**, não sincroniza dano e não prova transição com locomoção durante gameplay. Sem arma/IK/pernas fixas nem alterações para mascarar a pose. Scripts e artefatos congelados nos [hashes finais](../../output/brute-motion-v4/delivery-manifest.json).

CPU estrutural anterior8/8 e execução nativa sem erros são checkpoints técnicos separados desta **rejeição artística**. Reproduzir as folhas existentes sem GPU: `python3 tools/brute-motion-review-report.py`. Não abrir outra captura equivalente.

## Histórico CPU preservado

Os parágrafos abaixo registram seleção/preparação anteriores ao julgamento nativo; referências a GPU ou native pendentes são históricas. [Handoff antes do fechamento](../../output/brute-motion-v4/source-history/handoff-before-native-final.md).

## Fonte e atuação

Fonte runtime Brute SHA `d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a`. Cópias e [proveniência](../../output/brute-motion-v4/provenance.json) preservam rig/source, quatro outros clips e materiais. V3 `93b493e7…`/Mutant Punch rejeitado fica em `source-history/`; nenhum arquivo `/tmp` foi editado.

Acervo local Mixamo autorizado: `quake/public/assets/anims/mixamo/`. README local registra FBX Mixamo→GLB anim-only via fbx2gltf/gltf-transform. Não é download/provider novo nem declaração CC0; procedência local, FBX e licença comercial não foram auditados nesta rodada.

| Take | Fonte SHA256 | Candidato SHA256 | Decisão CPU |
|---|---|---|---|
| Zombie Attack 2,2.5s | `d213f923971eb091af7e43078bf8477a3dd695cda74361305db6b19399a44d12` | `71db982309c7245751597e9e40c81835325d2218f8108001ba43ffc284371741` | Frontal para native; antecipação mais alta, inclinação no seguimento ainda exige julgamento |
| Mutant Swipe,2.666667s | `f834f64b044673894274b7fd63b6ce671254a1197d2564974ca5fd155e180fdc` | `621c43a7250c7845ab9171468a04e8ef19bef2c1e3698a5675d25001155ef2f8` | Rejeitado: base baixa e torso torcido |

Inventário adicional somente: Zombie Attack conhecido do Walker; Mutant Punch explicitamente excluído. Comparação ficou limitada a dois takes. Nenhuma arma adicionada.

## Retarget e preservação

[Builder reprodutível](../../tools/brute-motion-review-build.mjs) copia o método existente: delta mundial da pose de repouso de22ossos, conjugação+90° e inversa do parent animado; quadril mantém bob vertical, XZ em posição. Ambas as cadeias das pernas usam rotação da fonte, **sem IK/pés presos/counter-rotation de quadril**. Correção vertical global de Armature por mínimo da malha a30Hz; não equivale a foot plant. Osso/offset/bind/hierarquia/skin não mudam.

Attack é o índice3 inteiro, sem crop. O binário original permanece prefixo byte-idêntico; nodes/skins/meshes/materials/images/textures/samplers e quatro outros clips idênticos estruturalmente. Bounds60Hz a3.3m de altura de repouso: frontal mínimoY −1.003mm a+2.224mm, Swipe −9.476mm a+23.185mm. São medidas geométricas, não aprovação de peso/deformação. A medição geométrica CPU usa3.3m de repouso. A fixture nativa foi corrigida para o método real do loader:3.3m medidos no Idle, escala3.356433, e os mesmos probes originais de chão.

[Poses CPU frontal](../../output/brute-motion-v4/frontal/cpu-pose-strip.png) e [Swipe](../../output/brute-motion-v4/swipe/cpu-pose-strip.png) são projeções de vértices skinned, sem texturas, **não nativas nem gameplay**. Bug do primeiro amostrador (action presa no fim após clamp) corrigido com reset por seek; imagens erradas arquivadas. Agora sete poses completas distintas por take. Chão correto não elimina a rejeição artística do Swipe.

## Perfil e limite de timing

[Perfis](../../output/brute-motion-v4/attack-profiles.json) e [adapter somente em cópia](../../output/brute-motion-v4/attack-profile-adapter.mjs). Frontal: full Attack2.5s→**.55s,4.54545×**, cooldown de referência.62s; fase proposta.413333333, sourceTime1.033333333s, **impactAt.227333333s**, `R_Hand`. Marcador vem do maior alcance frontal da mão, sem alvo/contato confirmado.

`getMeleeTiming('brute')` retorna null. Main chama visual.55s, cooldown.62s e aplica dano **imediato**; server aplica dano imediato e fallback.62s. Portanto **desalinhamento.227s pendente para Combat**, sem mudança de range/dano/cooldown/autoridade e sem alegar sincronização. A compressão4.55× pode destruir o peso: a decisão nativa precisa olhar tempo real, não só playback na duração fonte.

Loader atual recorta Attack e pode achatar Hip.position; copiar apenas o GLB não preservaria este take. Adapter valida ID/perfil/Attack completo e clona sem slice/flatten, **não importado em runtime**. Não usar flag genérica `bipxMotion` para ativar o slice Walker1/3→5/3. Integração futura depende de Combat/Animation e nova prova; não copiar loader inteiro nem incluir Lich nesse lote.

## Reproduzir

```sh
node tools/brute-motion-review-build.mjs
python3 tools/brute-motion-review-cpu-poses.py
node tools/brute-motion-review-verify.mjs
# Apenas depois de liberação real da fila registrada em gpu-window.json:
node tools/brute-motion-review-native.mjs
```

Builder usa cópias em `source/` e recusa sobrescrever resultados diferentes; arquivar revisão antes de mudar. CPU: restError4.88e−7rad, norma/offset dentro dos limites; ambos os takes finitos e pernas animadas. Native preparado em servidor efêmero próprio, sem5173, Chrome/Metal,3/4+ARPG e vídeo RAF. Até aqui nenhuma prova nativa Brute v4 nem aceitação de contato/peso/AAA/rede. Próxima escrita prevista apenas evidências/seleção deste staging após janela GPU.

## Correção do preview antes da GPU,03:38 UTC

A execução CPU do JavaScript literal da fixture (`tools/brute-motion-review-playback-cpu.mjs`, renderer falso/RAF determinístico) detectou Idle37cm sob o piso por ausência da normalização/ground do loader. Corrigida **somente a fixture**: altura pelo Idle e translaçãoY pelos probes originais. GLB `71db9823` não mudou; versões anteriores arquivadas em `source-history/before-preview-ground-fix/`. Nada de IK, pernas fixas ou novo retarget.

**Limite conservado, não afrouxado:** probes originais não cobrem todo o novo Attack; penetração residual máxima observada14.67mm em.55s e16.76mm na fonte2.5s. Gate diagnóstico12mm não passou; relatórios finais o expõem separadamente dos checks de tempo/finite. A prova bruta do GLB (sem correção do loader) tinha−1.003/+2.224mm na outra escala. Não transferir esse resultado ao blend/ground do loader. CPU também mostra queda acentuada do quadril do Idle à base do take, risco de entrada brusca a4.55×; native precisa julgar esse risco, sem esconder com IK.

Tempos CPU determinísticos: primeiro frame de recovery.566667s no caller.55s (amostragem60Hz),2.516667s na fonte2.5s; zero alongamento artificial do clock. Isso não é prova de reprodução nativa. A captura mantém o perfil pedido, não altera cooldown/autoridade e não corrige geometricamente o candidato para forçar aceite.

**Congelamento CPU para a fila:** fonte frontal/preview/perfil prontos; status nativo continua pendente, nenhum `gpu-window.json` emitido nem GPU tomada. [Manifesto desta preparação](../../output/brute-motion-v4/prepared-manifest.json). [Execução CPU final](../../output/brute-motion-v4/playback-cpu-2026-09-19T03-43-11-310Z.json), [medidas da transição](../../output/brute-motion-v4/preview-transition-findings.json): quadril1.746→.929m no caller, pico de variaçãoY.215m por frame60Hz na entrada. Risco artístico concreto, não mitigado por congelar pernas. Combat ainda mantém a janela de QA/correção lifecycle do canhão; aguardar encerramento publicado antes da captura frontal curta. Próxima escrita: apenas evidência nativa e decisão bounded, sem terceiro take.

**Sinal Root posterior à captura:** registrado em `gpu-window.json` com checagem atual. A rodada03:58 já satisfaz o escopo frontal71db/3-4+ARPG/.55tempo real+2.5fonte; não repetir nem retroagir o timestamp da autorização. GUI compact focal é a próxima por ordem Root.
