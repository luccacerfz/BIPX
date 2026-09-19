# V9 — extensão da mesma trajetória, CPU somente

**Concluída, sem promoção/novo candidato/GPU.** Mesmas fontes v8 `45588e13` e v9 `cae3cb8e`, take `d3cd29b3`; runtime `07952bfc` intacto. Autorização Root após [A/B nativo](animation-backward-v9-native-ab.md). [Comparação completa](../../output/arpg-animation/backward-v9/extended-history/comparison.json) · [causa do retorno](../../output/arpg-animation/backward-v9/extended-history/return-transition-cause.json) · [plano/hashes](../../output/arpg-animation/backward-v9/extended-history/plan.json).

## Recorte e preservação

Quatro replays CPU: v8/v9 ×30/60Hz, velocidade6.5m/s,151/301frames até5.0333/5.0167s. O único delta no runner histórico é61→151 e121→301frames; não há parâmetro de pose novo. Prefixos0–60/0–120 **exatamente iguais** aos JSONs anteriores. Input original preservado: ré até1.5s, curva até2.1, strafe até3.0, retorno até3.6, ré depois. Não foi inventada uma nova trajetória para obter resultado melhor.

Dois ciclos completos Strafe comprovados por wraps sucessivos:30Hz frames65→77→89 (2.20→2.60→3.00s);60Hz130→154→178 (2.1833→2.5833→2.9833s). Mais quatro ciclos completos de ré após o retorno, incluindo aterrissagens subsequentes. Toda a história e ambos os pés estão nos dados, sem retirar início, transição ou samples sem patch.

Auditor original byte-idêntico; seu CLI de trajetória constante não foi adulterado. O runner existente usa os mesmos vértices skinWeight>.75 e predicados físicos:±8mm piso,3mm do mínimo local, velocidade vertical≤.05m/s em ambos os frames. Os arrays de patches são os do runner inalterado. Zero pares qualificados =count0/P90null, nunca PASS. Flags/trajetória idênticos entre candidatos; máximo delta de objetos protegidos6.66e−16, posições/escalas locais de pernas0, reach0 e sola mínima~1.965mm. Instrumentação contra cópia não observada: perturbação0.

## O ganho é localizado, sem regressão posterior de material

V9 deixa de diferir geometricamente de v8 apósframe61/30Hz (2.0667s; última diferença.855mm por componente) e124/60Hz (2.0833s;.057mm). Não há ganho adicional nos ciclos posteriores; o mecanismo modifica a saída do take donor, não todo Strafe. Na extensão nova os90/372pares de patch comuns são **exatamente iguais em velocidade**, zero pares adicionados/perdidos.

| Janela nova, após prefixo anterior | Apoio P90 / amostras — ambos | Transição P90 / amostras — ambos | Cobertura — ambos | Flag apoio sem patch — ambos |
|---|---:|---:|---:|---:|
|30Hz61–150|.625489m/s /75|.183492m/s /15|16.667%|44foot-frames|
|60Hz121–300|.168666m/s /355|1.402702m/s /17|21.389%|68foot-frames|

Nos dois ciclos Strafe30Hz, apoioP90=.242113/.241491 com12pares por ciclo/cobertura16.667%;60Hz=.186325/.168666 com74/73pares/cobertura22.917%. Mesmos números v8/v9. Pares swing→swing junto ao piso:count0/null nos quatro casos; isso não aprova swing/no-slide.

O agregado0–5s60Hz melhora.168666→.155345 porque inclui o ganho antigo108–110. Não interpretar isso como benefício novo persistindo por5s: as amostras novas são iguais. O apoio local.763592→.053884 continua válido no recorte original, com as pendências já documentadas de região/cobertura.

## Defeito concreto revelado: reset de apoio na volta Strafe→ré

**Comum aos dois candidatos**, não causado por v9.30Hz frame100/t3.3667s e60Hz200/t3.35s: material99 permanece fisicamente qualificado, contact=true nos dois frames, sola~2mm. Seu deslocamentoXZ é110.775mm/33.33ms (3.32324m/s) e44.365mm/16.67ms (2.66187m/s). Velocidade vertical−.00225/−.00381m/s, portanto não é descarte honesto por decolagem; é deslizamento de patch qualificado durante troca.

Traço mostra `previousContact=false` e `locked=false` internamente já no estágio layered do frame da troca, embora os flags externos permaneçam true→true. A causa no código é delimitada: `outgoingDonor` preserva suporte apenas ré→Strafe; no sentido inverso `clearContacts()` descarta o apoio antes da resolução e recaptura outro witness217→120. Nesse frame a etapa anchor não corrigeXZ do resultadoIK; no frame seguinte volta a corrigir normalmente. Não usar a distância entre anchors217/120 como deslocamento material, pois mudou a identidade: os valores acima medem **o mesmo vértice99**.

Contrafactual algébrico simples, sem novo replay/solver: transladar a pose final para reter o mesmo material217 anterior cabe na cadeia (.7242/.7226m solicitados contra limite.8251m), mas enterraria o mínimo em−3.93/−1.99mm. Portanto apenas copiar o antigo anchor3D não resolve a região/piso; orientação/altura do apoio precisam ser conciliadas. Isso **não prova necessidade de deslocar pelvis**, pois alcance ainda tem folga; tampouco autoriza relaxar piso ou flags. A próxima investigação indicada é preservar continuidade do apoio na troca inversa e tornar a pose/roll compatível com a região baixa antes de recapturar. O corpo conjunto continua opção separada caso apareça incompatibilidade física real, não compensação arbitrária.

Também persistem transientes antigos: landing esquerdo57/30Hz8.582m/s e início2/4com11.326/12.684m/s constam do relatório completo, sem serem excluídos nem reclassificados. Nenhuma matriz9.1/start-stop/casts adicional foi executada.

**Entrega:** A/B nativo concluído e extensão limitada concluída; v9 retida. Nenhuma autorização de promoção de controlador é inferida. Provas desta etapa continuam ligadas ao GLB original0e5da9d8, mesmo após eventual correção separada de metadados Aldric autorizada pelo Root. Combat prepara Lich apenas em cópia; revisão de loader/pool fica para pedido posterior.
