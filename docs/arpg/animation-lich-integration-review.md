# Lich — revisão Animation do candidato Combat

**Adendo 05:10 UTC — achado de marcador corrigido por Combat em cópia.** Li a correção de `main` **2a5dd1ae** e apresentação **3b14137d**: amostra o release antes do estado visual final; a previsão pendente para no marcador até confirmação, sem rebobinar autoridade/controller. Li o [witness real atualizado, nove casos](../../output/lich-cast-integration-v1/cpu/2026-09-19T05-04-57-098Z/release-marker.json): idades finais .60/.70/1.20 × previsão 0/.4/2 s, erro de socket zero, um flash por caso, fontes estáveis. Loader/pool permanecem os revisados. O achado abaixo fica preservado como antes, resolvido neste recorte CPU. Captura focal da correção pertence a Combat; não reatribuir native antigo main6772 a esta versão. Nenhuma edição/promoção desta frente.

Revisão limitada concluída em 2026-09-19, somente sobre `output/lich-cast-integration-v1/candidate`. **Nenhuma promoção, GPU ou alteração de runtime.** [Recibo e hashes](../../output/arpg-animation/lich-integration-review/review.json). Loader `de4376a2`, pool `f11e5277`, sidecar `8194b989`, perfil `4c21be8e`. O pool recebeu de Combat a guarda de castId ausente durante esta revisão; o CPU visual mais recente de 04:57:22 corresponde exatamente aos sete arquivos protegidos. O CPU anterior 04:50 permanece histórico, sem reatribuição.

## Loader e pool

Não encontrei impedimento nesses dois módulos dentro do recorte revisado:

- Perfil opt-in somente no caster. O pool usa tipo como chave; Visor compartilha o GLB Lich, mas continua sem o novo perfil. Walker e Brute mantêm clips, recorte e caminho padrão.
- Attack inteiro de 1.1666666269302368 s, duração visual 1.10 s, release .5971428571428572 s e L_Hand. A normalização preserva Hip vertical e evita o crop Walker no perfil novo. GLBs originais e sidecar/perfil mantêm os hashes do pacote Animation/SFX.
- Entrada no meio do cast aplica peso inteiro; payloads repetidos não avançam o relógio duas vezes. O caller de rede extrapola a idade por frame antes de enviá-la ao pool, portanto essa proteção não limita a animação à frequência do snapshot.
- Freeze/stun cancelam e seguram pose; descongelar não reinicia a identidade terminal. O getter lê o socket, exige identidade válida e não aloca nem emite projétil. Reentrada de LOD usa a idade atual. Corte continua capturando a pose antes de reciclar.

Li os dez grupos do [CPU visual 04:57](../../output/lich-cast-integration-v1/cpu/2026-09-19T04-57-22-443Z/visual.json), o teste e as fontes; os hashes conferem. Não repeti a suíte inalterada nem tratei CPU como prova nativa. O perfil histórico `status` permanece literal para preservar seu hash; o estado vigente é o destes handoffs.

## Ajuste devolvido a Combat: pose do flash de rede

O receiver `syncNetworkCasterCast` primeiro aplica `result.visual` na idade final do snapshot e depois lê L_Hand para o release. O caller offline já amostra `event.elapsed` antes da idade final. Isso diverge do contrato de amostragem do marcador; não é duplicação de dano ou projétil.

[Witness reproduzível](../../output/arpg-animation/lich-integration-review/release-marker.mjs) · [resultado](../../output/arpg-animation/lich-integration-review/release-marker.json). Executa o receiver literal do candidato, core/inbox reais e loader/mixer/pool reais. O VFX final é um coletor de posições; imagens são omitidas apenas em memória para CPU. Um snapshot inicial prepara a pose em .5 s com peso inteiro; três ticks limitados atravessam o release.

| Idade final | Idade lida pelo getter | Evento release | Distância ao socket no marcador |
|---|---:|---:|---:|
| .60 s | .60 s | .597143 s | 1.681 mm |
| .70 s | .70 s | .597143 s | 68.984 mm |
| 1.20 s, cast já terminal | 1.10 s | .597143 s | 18.656 mm |

No último caso, o mixer ainda conserva a pose anterior de .5 s enquanto stats já indicam Idle/elapsed 1.10. Um flash por caso, fonte estável. São medições CPU nesta pose/altura, não avaliação de visibilidade nem garantia para todo atraso. O teste receiver de Combat usava socket stubado e validava contagem/terminal/dedup, portanto não cobria esta posição.

Correção solicitada a Combat via `msg_8eac8ee18489`: amostrar o marcador antes de aplicar o visual final, preservando dedup/terminal/idade monotônica e sem replay histórico. Se a projeção já passou do marcador, não rebobinar silenciosamente o controller vivo; resolver a amostragem de apresentação explicitamente e comprovar também release+end no mesmo tick. Origem/altura da colisão autoritativa permanecem inalteradas. A correção e os callers pertencem a Combat; não os editei.

A primeira execução do harness enviava preparo e todos os estágios com dt de render zero, congelando o fade inicial e produzindo um desvio artificial de 1.317 m. Foi rejeitada como evidência do produto e preservada em `release-marker-zero-time-harness.json`. O witness válido usa chegada inicial a .5 s, exercitando o caminho real de entrada no meio do cast. Não confundir os resultados.

**Readiness:** loader/pool liberados por Animation para a prova focal de Combat, condicionada à correção/verificação do flash e ao lote coerente ainda em staging. Native prepare/release/recovery, controles, corpse e dois clientes seguem gates próprios. Aldric OPAQUE foi promovido em lote separado; esta cópia Lich continua ligada ao seu baseline original. Heróis 07952, corte e37398db e servidor 5173 preservados. Nenhuma próxima GPU Animation reservada.
