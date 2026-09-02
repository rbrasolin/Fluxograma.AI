/* =========================================================
   15-ia-import.js  |  Gerador de Fluxograma
   "Monte seu fluxo com IA": prompt padrão (transcrição de entrevista, IT ou POP)
   + import do JSON gerado pela IA.

   O JSON usa o mesmo contrato estrutural do modelo Excel (área, atividade, tipo,
   sistema, tempo, cor, naoNum) — por isso o import só converte pro formato
   {topo, linhas} e delega para excelAplicarBase (14-excel-io.js), sem duplicar
   lógica de posicionamento/conexão. Não toca no pipeline do SVG Excel (08-excel.js).
   ========================================================= */

const PROMPT_IA_TEXTO = `Você vai me ajudar a transformar um documento (transcrição de entrevista, instrução de trabalho ou POP - Procedimento Operacional Padrão) em um arquivo estruturado que uso numa ferramenta de mapeamento de processos.

O documento vem colado ou anexado logo em seguida a esta mensagem. Pode ser de dois tipos, e isso muda como você deve interpretá-lo:

- DOCUMENTO JÁ ESTRUTURADO (instrução de trabalho, POP): os passos normalmente já vêm na sequência real de execução — extraia respeitando essa ordem. Fique atento a sub-itens, observações e regras que podem não ser "passos" e sim condições aplicadas dentro de um passo; só vire atividade separada o que for de fato uma ação distinta, executada por alguém.

- TRANSCRIÇÃO DE ENTREVISTA/CONVERSA (não estruturada): a ordem em que as coisas foram DITAS não é necessariamente a ordem em que elas ACONTECEM no processo. Quem está sendo entrevistado costuma voltar atrás pra explicar algo, citar uma exceção fora de ordem, ou retomar um assunto depois de ser interrompido. Sua tarefa é reconstruir a sequência REAL de execução, não a sequência da conversa. Para isso:
  - Identifique o gatilho/início do processo (o que faz ele começar) e o fim (o que indica que terminou).
  - Use conectores temporais e lógicos como pista de posição real, mesmo quando o passo foi citado fora de ordem na fala: "primeiro", "depois", "em seguida", "antes de", "só depois que", "assim que", "quando isso acontece", "se der certo/errado", "quando chega nesse ponto".
  - Quando a pessoa mencionar uma exceção, um retrabalho ou um "às vezes acontece de..." — isso normalmente é um ponto de decisão. Identifique como decisão e posicione no lugar certo da sequência, não onde foi citado na fala.
  - Se, mesmo depois de reconstruir a sequência, restar uma ambiguidade real (não dá pra saber com segurança onde um passo entra ou se ele existe), NÃO invente uma posição — sinalize isso explicitamente como pendência na ETAPA 1, junto com a pergunta.

ETAPA 1 — Antes de gerar qualquer arquivo, identifique quantos processos distintos aparecem no documento (um mesmo documento, principalmente uma entrevista, pode descrever mais de um processo). Para cada processo identificado, me apresente:
  - um nome curto para o processo;
  - um rascunho da sequência de passos, numerado, só com o nome de cada atividade (sem os campos técnicos ainda);
  - quais desses passos você identificou como pontos de decisão (e para onde vai o "Não" de cada um);
  - qualquer trecho em que a ordem ficou ambígua ou você não teve certeza.

Depois do rascunho detalhado (de todos os processos, se houver mais de um), feche a resposta com um bloco separado, sob o título "Perguntas para confirmar", trazendo SÓ as perguntas que eu preciso responder — numeradas (1, 2, 3...), objetivas e curtas, sem repetir o rascunho por extenso. Inclua nesse bloco, no mínimo: a confirmação do nome de cada processo, a confirmação de que a sequência está correta, a confirmação de cada ponto de decisão identificado (e do destino do "Não"), e uma pergunta pra cada ambiguidade sinalizada. Formato esperado:
Perguntas para confirmar:
1. Confirma o nome do processo "X"?
2. A sequência de passos está correta como listada acima?
3. O passo "Y" é mesmo um ponto de decisão? O "Não" volta pro passo Z?
4. [uma pergunta objetiva por ambiguidade encontrada]
Isso é o que eu vou responder direto, número por número — não repita nem resuma o rascunho aqui, só as perguntas.

Não gere nenhum arquivo ainda. Espere eu confirmar (ou corrigir) a lista de processos e a sequência de cada um.

ETAPA 2 — Depois que eu confirmar, gere um arquivo JSON PARA CADA processo confirmado, neste formato exato:

{
  "processo": "",
  "desenho": "",
  "analista": "",
  "negocio": "",
  "area": "",
  "gestor": "",
  "valorFTE": "",
  "volumetria": "",
  "atividades": [
    {
      "num": 1,
      "area": "",
      "atividade": "",
      "tipo": "",
      "sistema": "",
      "tempo": "",
      "cor": "",
      "naoNum": ""
    }
  ]
}

Regras obrigatórias para o conteúdo de "atividades":
1. Ordem cronológica REAL do processo (ver orientação acima), uma atividade por item, "num" sequencial (1, 2, 3, ...).
2. "area": a área, cargo ou pessoa responsável por aquela atividade (ex.: "Financeiro", "Controladoria", "Fiscal"). Se não estiver claro no documento, deixe "".
3. "atividade": descrição curta e objetiva da ação (verbo + o quê). Não invente passos que não estão no documento.
4. "tipo": escreva exatamente "Decisão" quando a atividade for um ponto de decisão do tipo sim/não (ex.: "NF está correta?"). Para as demais atividades, você pode escrever uma categoria curta se estiver clara no documento (ex.: "Manual", "Sistêmico", "Aprovação"); se não tiver certeza, deixe "".
5. "sistema": sistema, planilha ou ferramenta usada nessa atividade, se mencionado. Se não for mencionado, deixe "".
6. "tempo": duração da atividade, só se estiver explícita ou for possível estimar com segurança a partir do documento. Formato OBRIGATÓRIO: "H:MM:SS" (horas:minutos:segundos) — sempre em horas, NUNCA escreva por extenso tipo "5min", "2h" ou "1 dia"/"2 dias". Se o documento mencionar dias, converta pra horas usando 1 dia = 24 horas. Exemplos: 5 minutos → "0:05:00"; 30 minutos → "0:30:00"; 2 horas → "2:00:00"; 2h30 → "2:30:00"; 1 dia → "24:00:00"; 2 dias → "48:00:00"; 10 dias → "240:00:00". Sem base pra estimar, deixe "".
7. "cor": deixe sempre "" (a ferramenta usa branco como padrão).
8. "naoNum": preencha só para atividades com "tipo": "Decisão" — o número ("num") da atividade para onde o processo vai quando a resposta é "Não". O caminho do "Sim" não precisa ser informado; a ferramenta assume que "Sim" segue automaticamente para a próxima atividade da sequência.
9. Nunca invente informação que não está no documento. Quando não tiver certeza ou a informação não aparecer, deixe o campo em branco ("").
10. Os campos de cabeçalho ("processo", "desenho", "analista", "negocio", "area", "gestor", "valorFTE", "volumetria", fora da lista de atividades) só devem ser preenchidos se estiverem claramente identificáveis no documento; senão, deixe "".

FORMATO DE ENTREGA (obrigatório): cada processo deve ser entregue como um ARQUIVO .json de verdade, disponível para eu baixar — nunca escrito como texto/bloco de código dentro da própria conversa. Se a sua interface não tiver como gerar um arquivo para download, gere o conteúdo igual, mas deixe isso explícito antes de me entregar. Nome de cada arquivo: fluxo_<nome-do-processo>.json (troque <nome-do-processo> pelo nome curto do processo, em minúsculas e sem espaços/acentos, ex.: fluxo_fechamento-opex.json). Um arquivo por processo confirmado. Não escreva texto fora do arquivo, além da sua pergunta da ETAPA 1.`;

// ---------- Copiar o prompt ----------
function copiarPromptTextoFallback(texto) {
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const sucesso = document.execCommand("copy");
    document.body.removeChild(ta);
    return sucesso;
  } catch (e) {
    return false;
  }
}

function copiarPromptIA() {
  const aoCopiar = () => mostrarToast("Prompt copiado! Cole numa IA (Copilot, Gemini, Claude, ChatGPT etc.) junto com o documento.", "ok");
  const aoFalhar = () => mostrarToast("Não consegui copiar o prompt automaticamente. Tente novamente ou selecione e copie manualmente.", "alerta");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(PROMPT_IA_TEXTO).then(aoCopiar).catch(() => {
      if (copiarPromptTextoFallback(PROMPT_IA_TEXTO)) aoCopiar(); else aoFalhar();
    });
  } else if (copiarPromptTextoFallback(PROMPT_IA_TEXTO)) {
    aoCopiar();
  } else {
    aoFalhar();
  }
}

// ---------- Import do JSON gerado pela IA ----------
function iaJSONparaBase(dados) {
  const norm = s => String(s == null ? "" : s).trim();
  const topo = {};
  ["desenho", "processo", "analista", "negocio", "area", "gestor", "valorFTE", "volumetria"].forEach(campo => {
    if (dados && dados[campo] !== undefined) topo[campo] = norm(dados[campo]);
  });

  const bruto = (dados && Array.isArray(dados.atividades)) ? dados.atividades : [];
  const linhas = [];
  bruto.forEach((item, i) => {
    const atividade = norm(item && item.atividade);
    if (!atividade) return;
    linhas.push({
      num: norm(item.num) || String(i + 1),
      area: norm(item.area) || "Sem Área",
      atividade,
      tipo: norm(item.tipo) || "Não informado",
      sistema: norm(item.sistema) || "Sem sistema informado",
      tempo: norm(item.tempo),
      cor: excelCorParaEN(norm(item.cor) || "branco"),
      naoNum: norm(item.naoNum)
    });
  });

  return { topo, linhas };
}

function importarFluxoIA(event) {
  const input = event && event.target ? event.target : null;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const finalizar = () => { if (input) input.value = ""; };

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const dados = JSON.parse(String(reader.result || ""));
      const base = iaJSONparaBase(dados);
      if (!base.linhas.length) {
        mostrarToast("Não encontrei atividades no arquivo. Confira se ele segue o formato do prompt (chave 'atividades').", "alerta");
        return;
      }
      excelAplicarBase(base, "Base importada da IA. Clique em Gerar Fluxo para visualizar.");
    } catch (e) {
      console.error(e);
      mostrarToast("Não consegui ler esse arquivo. Ele é um .json válido gerado a partir do prompt?", "erro");
    } finally { finalizar(); }
  };
  reader.onerror = () => { mostrarToast("Falha ao ler o arquivo.", "erro"); finalizar(); };
  reader.readAsText(file, "UTF-8");
}
