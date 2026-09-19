# GUI — Safari no iOS Simulator: integração e evidência focal

## Promoção05:37UTC — somente CSS70bytes, fonte GUI congelada

Root selecionou o delta exato em [review/gui-safari-input-selection.md](review/gui-safari-input-selection.md). Combat encerrou o checkpoint Environment/JEF225fontes e liberou a microjanela por `msg_7ceaf37c89d6` às05:36:28. **Promovido somente o candidato70bytes6026285b em styles.css atual**, por append direto; os59.579bytes anteriores permanecem idênticos, sem copiar stylesheet de snapshot ou acrescentar bytes além do delta. Nenhuma nova fonte runtime planejada pela GUI.

- Baseline arquivado: `385f8f9a101fdb55b2fffd0cc3b77b2613782789b9237bd39beacadbda9d3ab3`.
- Delta70bytes: `6026285be87e1d96d5f29fcc7556001f2025cdd1e5d833e54845772f6921a4cc`.
- **styles.css final59.649bytes: `0dfb40e3a4b21e6e34b7de521a9544a9fc1f9a278718c35468e4962964c6a3ac`.**

[Recibo](../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/receipt.json), [baseline](../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/styles.before.css), [diff exato](../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/delta.patch), [manifesto](../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/manifest.json). HTTP5173retornou200 `text/css; charset=utf-8`,59.649bytes/hash idênticos ao disco; servidorPID65261preservado. Fingerprint225fontes antes/depois: **somente styles.css mudou**. Mainc0fbc03b, Environment/nav, index/viewport, input/JS/HUD/assets intactos. `git diff --check` passou. Sem restart, boot, GPU, browser, matriz ou suíte nova.

Essa é integração CPU/HTTP do candidato selecionado. **Safari integrado e scroll com QWERTY continuam pendentes**, assim como físico/VoiceOver/desempenho; os PNGs20/23/24 e a telemetria A/B abaixo continuam prova nativa de staging anterior. Nenhum bloqueio de zoom manual nem reset forçado. JEF Environment/evidence/source-manifest anteriores permaneceram byteidênticos; a promoção entra como adendo posterior, sem reenviar JEF/global. [Versão integral deste documento antes da promoção](../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/gui-ios-safari-v1.before.md).

## Histórico — captura05:03–05:21 e staging anteriores à promoção

O restante desta seção conserva a proveniência e os limites da rodada anterior; as menções a CSS385f8f9a ou candidato não promovido descrevem o estado05:21, não o runtime integrado05:37.


**05:21 UTC: GPU GUI liberada, runtime congelado. Resultado `requires_further_work`.** Safari/WebGL, nome/classe e entrada real foram observados; o live apresentou recorte do HUD depois do foco. A/B nativo confirmou zoom residual com input15px e sua prevenção por CSS16px em staging. Scroll com QWERTY aberto continua pendente; nenhum aceite global/mobile físico.

## Ambiente, ownership e preservação

**Simulator, não aparelho físico:** iPhone16, iOS26.5/23F77, portrait393×852, framebuffer1179×2556. Dispositivo efêmero dedicado `BIPX-GUI-Safari-20260919`, UDID `9A7AF593-B212-4519-BB97-9D16FFD6B2E1`, criado após inventário read-only. Os25devices existentes mantiveram nome, estadoShutdown, tipo, disponibilidade e lastBootedAt. O runtime instalado só atualizou `lastUsage` pelo boot do dedicado. Nenhum pacote/runtime/Xcode instalado, Unity operado ou dispositivo de outro projeto tomado. [Comparação](../../output/gui-ios-safari-v1/inventory-comparison.json).

Janela liberada explicitamente por Combat `msg_18d83eee2edd` e encerramento VFX05:00; não inferida da ausência do lock. Reserva atômica05:03 owner `gui-ios-safari-v1`, PID20959, token `e442ea68-7be5-46d6-ad80-9f879dae2b3d`. Controle nativo com skill Orca Emulator; capturas originais por `simctl io OWN_UDID screenshot`. A preparação/limites dos controles estão preservados em [histórico](../../output/gui-ios-safari-v1/preparation-document.history.md).

Todos os222arquivos do manifesto nativo permaneceram idênticos, incluindo Aldric5c/Surface atuais. **styles live SHA256 `385f8f9a101fdb55b2fffd0cc3b77b2613782789b9237bd39beacadbda9d3ab3`**, servido comHTTP200 e hash idêntico.5173/PID75665 preservado, sem restart. [Antes](../../output/gui-ios-safari-v1/source-native-before.json), [depois](../../output/gui-ios-safari-v1/source-native-after.json), [baseline CSS arquivado](../../output/gui-ios-safari-v1/styles.live-baseline.css).

## Prova live e limite do teclado

Rota real `http://localhost:5173/?offline=1`. Safari desenhou o cemitério/WebGL. Entrada por toque abriu nome/personagens; nome alterado para `Cacador QA`, Lyra selecionada e ready. [05-keyboard.png](../../output/gui-ios-safari-v1/05-keyboard.png) é a prova de **QWERTY virtual completo**, depois da apresentação inicial do teclado iOS. Campo visível sem Som cobrindo foco; CTA alcança a borda inferior útil. Não houve prova concluída de scroll mantendo esse QWERTY aberto.

Após `orca emulator type`, a imagem seguinte mostrou só a barra acessória. A associação temporal com HID foi observada; a causa interna exata não foi demonstrada. `06-keyboard-scroll-action`,08,13 e22 têm nomes históricos, mas **não são prova de QWERTY/scroll**. Um detach/reattach do helper, tentativa nativa Cmd-K e um único reboot do dedicado não o restauraram. O menu Simulator expôs controles de teclado desabilitados. A preferência global `ConnectHardwareKeyboard=true` foi preservada, sem mudança. Nenhuma solicitação de autenticação física/Mirroring decorre desse limite.

Após Done e Start reais, [16-real-start-settled.png](../../output/gui-ios-safari-v1/16-real-start-settled.png) mostra Lyra, duas esferas e três skills pintadas, mas **tempo/progresso recortados no topo e Pause além da borda direita**. Portanto não aprova HUD completo. As capturas17/25 são game-over natural antes da tentativa de pausa, não evidência de pause. Nenhum score, HP ou estado foi forçado.

## Causa demonstrada por A/B no mesmo Safari Simulator

Fonte relevante: `styles.css:89` define15px no nome; `src/main.js:1627` foca esse campo e `src/main.js:2518` usa dimensões do visualViewport. Index mantém zoom acessível. O defeito não foi inferido só pela fonte/PNG: a cópia instrumentada reproduziu a escala e os offsets, então mudou exclusivamente o tamanho do input.

Servidor próprio efêmero65503 encaminhou os bytes de5173, acrescentando telemetria **somente leitura** de visualViewport/rects. `guiCandidate=0` manteve CSS15px; `guiCandidate=1` acrescentou o candidato16px. Sem mudança de main, viewport meta, handlers, HP, score ou snapshots. Essa comparação de foco/blur usou Aldric padrão em ambos; o live16 anterior é Lyra. Não é matriz de classes nem fixture de gameplay inventada.

| Momento nativo | Font | Scale | Viewport | Offset left/top |
| --- | ---: | ---: | --- | --- |
| Baseline antes do foco |15px|1|393×695|0 / 0|
| Baseline foco19 |15px|1.0661578178|369×650|12 / 45|
| Baseline após Done20 |15px|1.0661578178|369×652|12 / 43|
| Candidato foco22 |16px|1|393×693|0 / 2|
| Candidato após Done23 |16px|1|393×695|0 / 0|
| Candidato Start24 |16px|1|393×695|0 / 0|

[Telemetria original](../../output/gui-ios-safari-v1/viewport-telemetry.jsonl) e [comparação](../../output/gui-ios-safari-v1/viewport-comparison.json). No candidato24, `.game-tools` está em x273.47/y64, largura111.53 dentro de393; HUD inferior x23.5/y580,346×105 dentro de393×695. O PNG nativo confirma a primeira linha tempo/progresso e Pause completos, além das duas esferas/três skills. Não houve corte, redimensionamento ou composição dos PNGs.

Antes/depois para inspeção: [foco15px](../../output/gui-ios-safari-v1/19-staging-baseline-focus.png), [foco16px](../../output/gui-ios-safari-v1/22-staging-candidate-focus.png), [blur15px](../../output/gui-ios-safari-v1/20-staging-baseline-blur.png), [blur16px](../../output/gui-ios-safari-v1/23-staging-candidate-blur.png), [HUD candidato24](../../output/gui-ios-safari-v1/24-staging-candidate-hud.png).

## Candidato GUI pronto, não promovido

[CSS70bytes](../../output/gui-ios-safari-v1/input-16px.candidate.css), SHA256 **`6026285be87e1d96d5f29fcc7556001f2025cdd1e5d833e54845772f6921a4cc`**:

```css
@media (pointer: coarse) {
  .name-field input { font-size: 16px; }
}
```

Evita o autozoom demonstrado sem `user-scalable=no`, `maximum-scale=1`, reset forçado de zoom, alteração de DOM/foco ou novo listener. Desktop/pointer fino retém15px. A correção limita-se ao nome em dispositivos de toque; não promete tratar zoom manual nem redesenha HUD. Runtime continua no hash385f8f9a. Promoção somente após seleção/coordenar dono Combat.

A/B nativo valida foco/blur e retorno ao HUD para esse candidato; **não valida QWERTY+scroll no candidato**, pois os frames22/23 exibem somente barra acessória. Esse é o restante focal, junto ao aceite integrado após eventual promoção; não requer boot/matriz ampla agora. Não há avaliação de físico, VoiceOver, performance, rede ou natural60s.

## Encerramento e recibos

Helper35492 (anteriores próprios22176/31851 já encerrados), proxy47379 e lease20959 terminaram. Dedicado estáShutdown, retido para reprodução; demais25devicesShutdown. Token próprio removido; lock ausente no recibo05:21:28. Nenhum próximo GPU GUI reservado. Combat/VFX/Physics avisados por Orca `msg_206691353d7a`, `msg_6fac11be4a63`, `msg_831ea272729f`. [Recibo](../../output/gui-ios-safari-v1/gpu-release.json).

[Report interpretado com hashes dos25PNG originais](../../output/gui-ios-safari-v1/report.json), [manifesto dos artefatos](../../output/gui-ios-safari-v1/delivery-manifest.json). `node --check` do proxy passou; verificações de preservação/hash foram focais. Nenhuma suíte global ou reclassificação de evidência antiga.
