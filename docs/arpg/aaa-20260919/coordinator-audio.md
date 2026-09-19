# Áudio nativo e reconexão — coordenação

Os sinais das duas classes passaram nas execuções indicadas abaixo. A reconexão passou 31/31 verificações na segunda execução. Isto comprova reprodução e ciclo de vida em Chrome/Metal, sem escuta humana ou teste em aparelho físico. Não constitui aprovação AAA da dimensão áudio.

| Execução em `output/qa/aaa-20260919/audio-native-v1/` | Resultado e escopo |
| --- | --- |
| `native-2026-09-19T10-22-19-685Z` | Lyra passou: três skills, impactos observados, ataque básico, pronto/recurso insuficiente, pausa e mute persistente. Aldric teve timeout aguardando áudio de cast; causa ainda não demonstrada. A rodada completa falhou. |
| `native-2026-09-19T10-28-30-604Z` | Aldric passou três skills, ataque básico, pronto/recurso insuficiente, pausa e mute persistente. Não houve confirmação nova de impacto para seus avanços. Reconexão passou 31/31. Rodada completa passou, fontes estáveis. |

A primeira rodada usou 243 fontes da integração v3; a segunda, 244 após integrar o posicionamento dos rótulos de loot. Os módulos e assets de áudio são os mesmos, mas cada resultado permanece vinculado ao seu manifesto. A aprovação de Lyra não foi reatribuída silenciosamente ao segundo candidato.

## PCM do mixer real

Captura estéreo do compressor final durante interação real com a interface, sem alteração de HP, recursos ou estado de combate. Os WAVs ficam na subpasta `audio-arpg-gameplay` de cada execução.

| Arquivo | Duração | Pico absoluto | Cauda após mute | SHA-256 |
| --- | --- | --- | --- | --- |
| Primeira execução: `arpg-gameplay-dwarf.wav` | 10,752 s | 0,379126 | 5,516e-9 | `c549349428aee53b13cc30ff5f912a93ff5ed1fb7c56272769332d779c942fbb` |
| Segunda execução: `arpg-gameplay-warrior.wav` | 10,709 s | 0,401563 | 8,643e-9 | `8a56654573cf4ef4502a9c2f7e5a5634aad38d761e7338156ad26e788a184e46` |

Picos abaixo de 1 e cauda próxima de zero sustentam ausência de saturação digital nessa captura e mute efetivo. Não medem preferência estética, inteligibilidade perceptiva ou equilíbrio musical.

## Reconexão

Dois clientes reais iniciaram grito de guerra e campo de gravidade. O harness fechou explicitamente o WebSocket do dono do campo como injeção de falha de transporte. O dono desconectado cessou os loops; o par conectado manteve os efeitos ativos. A retomada preservou identidade, recurso e cooldown, sem reproduzir cast/release/impact/end antigos. O mesmo campo retornou com duração restante de 4,9 para 2,9 segundos.

A primeira verificação do campo leu o estado antes de o snapshot conter `fields`, embora o áudio já estivesse ativo. O harness passou a aguardar a existência do campo antes de registrar o estado inicial. Essa correção foi apenas no instrumento de teste; os relatórios negativos foram preservados.

O timeout inicial de Aldric permanece como falha intermitente sem causa demonstrada. Uma repetição positiva não prova sua resolução. Relatórios canônicos: `report.json` de cada execução e `audio-grace-native/audio-grace-summary.json`.
