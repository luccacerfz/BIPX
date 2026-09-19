# Ré v7 — ganho de apoio com regressão na saída

Root leu o checkpoint9a530ce1, a decomposição do forefoot, a comparação limitada e o relato da expansão20casos. Fonte e runtime preservados conforme manifesto; não executou GPU nem promoveu.

A diferença entre direção misturada da pose atual e direção pura da previsão de aterrissagem explica o salto observado na entrada Strafe→ré. A compensação de yaw do antepé reduz apoioP90 a0,074/0,088m/s sem mudar flags/cobertura; isso é ganho CPU limitado, não aceitação visual de ausência de deslize.

A própria ampliação revelou alcance adicional27,23mm/30Hz e7,25mm/60Hz na saída ré→Strafe, seguido de zeragem abrupta de yaw/anchor apesar de contact=true. O candidato fica retido. Start-stop, cobertura e transições ainda não atendem ao objetivo, e a melhora de um witness não aprova toda a marcha.

Próxima tentativa v8 deve ser separada/preservada: continuidade geométrica de contato e yaw através da troca, sem prender pés além do apoio nem mascarar a falha por redefinir flags, reduzir velocidade, deslocar quadril ou relaxar a auditoria. Primeiro estudar frames53/54 a30Hz e106/107 a60Hz com a história anterior; ampliar só após resolver a causa. Não repetir a captura v6 ou promover v7.
