/* =========================================================
   02-tabela.js  |  Gerador de Fluxograma
   Tabela de montagem: UID, autocomplete, navegação, updateCampo, import Excel
   (linhas 221-1614 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
function gerarUID() {
  return "uid_" + uidCounter++;
}

function gerarIdVisual(index) {
  let n = Number(index) + 1;
  let resultado = "";

  while (n > 0) {
    const resto = (n - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    n = Math.floor((n - 1) / 26);
  }

  return resultado;
}

const CONFIG = {
  boxWidth: 250,
  boxHeight: 110,
  colGap: 140,
  rowGap: 70,
  marginX: 120,
  marginY: 60,
  fontFamily: "Arial, sans-serif",
  fontSize: 16,
  smallFontSize: 14,
  stroke: "#111111",
  lineWidth: 2.2,
  cornerRadius: 12,
  decisionWidth: 180,
  decisionTextWidthFactor: 0.52,
  decisionHeightFactor: 1.30,
  routeGap: 28,
  entryExitGap: 40,
  laneGap: 0,
  lanePaddingTop: 50,
  lanePaddingBottom: 50,
  laneLabelWidth: 70,
  laneEntryWidth: 110,
  laneHeaderFontSize: 16,
  laneHeaderFill: "#f7f7f7",
  laneBorder: "#bdbdbd",
  laneSeparator: "#d6d6d6",
  sameRowTolerance: 1,
  sameColTolerance: 1,
  sharedMergeGap: 34,
  obstaclePadding: 10,
  textLineHeight: 18,
  textPaddingVertical: 20,
  rectTextPaddingHorizontal: 16
};

const EXCEL_EXPORT_SCALE = 0.60;
// 0.85 = redução leve
// 0.72 = redução boa
// 0.65 = redução forte

const EXCEL_LAYOUT = {
  colGap: 70, //Espaço horizontal entre as colunas (atividades)
  rowGap: 36, //Espaço vertical entre atividades dentro da mesma raia
  laneGap: 50, //Espaço entre uma raia e outra
  lanePaddingTop: 50, //Espaço interno no topo da raia, Se estiver baixo → caixa “grudada” no topo
  lanePaddingBottom: 50, //Espaço interno na parte de baixo da raia, Evita que última atividade fique colada na borda
  laneLabelWidth: 22, //“Reserva” horizontal para a área da raia (estrutura no desenho da raia, não aplica no excel)
  laneEntryWidth: 12, //Espaço entre: área do nome da raia e início do fluxo (Muito pequeno → fluxo começa “em cima” da raia)
  startGap: 16, //Distância entre: o “Início” e a primeira atividade
  endGap: 26, //Distância entre: última atividade e o “Fim”
  laneTextOffsetLeft: 120, //Distância do nome da raia para a esquerda (Aumenta → nome vai mais para esquerda Diminui → nome se aproxima do fluxo)
  extraLeftPadding: 50 //Empurra TODO o fluxo para a direita
};

function aplicarEscalaSVGExcel(svgOriginal, escala = EXCEL_EXPORT_SCALE) {
  const svg = svgOriginal.cloneNode(true);

  const larguraOriginal = Number(svg.getAttribute("width")) || 1000;
  const alturaOriginal = Number(svg.getAttribute("height")) || 800;

  const viewBoxOriginal = svg.getAttribute("viewBox");
  let vbX = 0;
  let vbY = 0;
  let vbW = larguraOriginal;
  let vbH = alturaOriginal;

  if (viewBoxOriginal) {
    const partes = viewBoxOriginal.trim().split(/\s+/).map(Number);
    if (partes.length === 4 && partes.every(n => !Number.isNaN(n))) {
      [vbX, vbY, vbW, vbH] = partes;
    }
  }

  const filhos = Array.from(svg.childNodes);
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const grupoEscalado = criarElementoSVG("g");
  grupoEscalado.setAttribute(
    "transform",
    `translate(${-vbX},${-vbY}) scale(${escala})`
  );

  filhos.forEach(no => grupoEscalado.appendChild(no));
  svg.appendChild(grupoEscalado);

  const novaLargura = Math.max(1, Math.round(vbW * escala));
  const novaAltura = Math.max(1, Math.round(vbH * escala));

  svg.setAttribute("width", novaLargura);
  svg.setAttribute("height", novaAltura);
  svg.setAttribute("viewBox", `0 0 ${novaLargura} ${novaAltura}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  return svg;
}

function reaplicarSugestoesPosicao() {
  let areaAnterior = "";
  let colunaAnterior = 1;

  const posicoesOcupadas = new Set();

  fluxoData.forEach((linha, index) => {
    const areaAtual = normalizarEspacos(linha.area || "");
    const colunaAtual = Math.max(1, Number(linha.coluna) || 1);
    const linhaAtual = Math.max(1, Number(linha.linha) || 1);

    const linhaEfetiva = linha.linhaManual ? linhaAtual : 1;
    linha.linha = linhaEfetiva;

    const chavePosicao = (area, linhaNum, colunaNum) =>
      `${area}__${linhaNum}__${colunaNum}`;

    if (linha.colunaManual) {
      let colunaManualFinal = colunaAtual;

      while (
        areaAtual &&
        posicoesOcupadas.has(chavePosicao(areaAtual, linhaEfetiva, colunaManualFinal))
      ) {
        colunaManualFinal++;
      }

      linha.coluna = colunaManualFinal;

      if (areaAtual) {
        posicoesOcupadas.add(chavePosicao(areaAtual, linhaEfetiva, colunaManualFinal));
        areaAnterior = areaAtual;
        colunaAnterior = colunaManualFinal;
      } else {
        colunaAnterior = colunaManualFinal;
      }

      return;
    }

    let colunaBase = 1;

    if (index === 0) {
      colunaBase = 1;
    } else if (!areaAtual) {
      colunaBase = Math.max(1, colunaAnterior || 1);
    } else if (areaAtual === areaAnterior) {
      colunaBase = Math.max(1, colunaAnterior + 1);
    } else {
      colunaBase = Math.max(1, colunaAnterior || 1);
    }

    let colunaLivre = colunaBase;

    while (
      areaAtual &&
      posicoesOcupadas.has(chavePosicao(areaAtual, linhaEfetiva, colunaLivre))
    ) {
      colunaLivre++;
    }

    linha.coluna = colunaLivre;

    if (areaAtual) {
      posicoesOcupadas.add(chavePosicao(areaAtual, linhaEfetiva, colunaLivre));
      areaAnterior = areaAtual;
      colunaAnterior = colunaLivre;
    } else {
      colunaAnterior = colunaLivre;
    }
  });
}

function reaplicarSugestoesConexao(forcarTudo = false) {
  fluxoData.forEach((linha, index) => {
    const proximaLinha = fluxoData[index + 1] || null;
    const sugestaoUid = proximaLinha ? proximaLinha.uid : "";

    // Não criar o "Sim" automático para um destino que a própria linha JÁ liga
    // por outra via (conexão extra ou "Não"). Sem isso, uma caixa com "Sim"
    // vazio e uma extra apontando para a próxima da ordem ganhava proxSim ==
    // extra, gerando aresta duplicada (2 setas sobrepostas) e inflando as
    // contagens de handoff/loop.
    const jaLigaSugestao =
      !!sugestaoUid && (
        linha.proxNao === sugestaoUid ||
        (Array.isArray(linha.extras) && linha.extras.includes(sugestaoUid))
      );

    // Se a conexão já era automática, atualiza a sugestão
    if (linha.proxSimAuto && !linha.simRemovido) {
      if (jaLigaSugestao) {
        linha.proxSim = "";
        linha.proxSimAuto = false;
      } else {
        linha.proxSim = sugestaoUid;
        linha.proxSimAuto = !!sugestaoUid;
      }
      return;
    }

    // Onda 3: como não existe mais a coluna "Próxima", o "Sim" é SEMPRE a
    // próxima atividade da ordem. Garante a conexão sempre que o "Sim" estiver
    // vazio, EXCETO quando a saída foi removida de propósito no editor
    // (semSaida) ou quando esse destino já está ligado por outra via. Decisões
    // também recebem o "Sim" automático aqui; o "Não" continua manual.
    if (!linha.proxSim && !linha.semSaida && !linha.simRemovido) {
      if (jaLigaSugestao) return;
      linha.proxSim = sugestaoUid;
      linha.proxSimAuto = !!sugestaoUid;
    }
  });
}

function existePosicaoOcupadaNaRaia(uidIgnorar, area, linha, coluna) {
  const areaNormalizada = normalizarEspacos(area || "");
  const linhaNormalizada = Math.max(1, Number(linha) || 1);
  const colunaNormalizada = Math.max(1, Number(coluna) || 1);

  if (!areaNormalizada) return false;

  return fluxoData.some(item => {
    if (!item || item.uid === uidIgnorar) return false;

    const areaItem = normalizarEspacos(item.area || "");
    const linhaItem = Math.max(1, Number(item.linha) || 1);
    const colunaItem = Math.max(1, Number(item.coluna) || 1);

    return (
      areaItem === areaNormalizada &&
      linhaItem === linhaNormalizada &&
      colunaItem === colunaNormalizada
    );
  });
}

function obterProximaColunaLivreNaRaia(uidIgnorar, area, linha, colunaInicial = 1) {
  let coluna = Math.max(1, Number(colunaInicial) || 1);

  while (existePosicaoOcupadaNaRaia(uidIgnorar, area, linha, coluna)) {
    coluna++;
  }

  return coluna;
}


function adicionarLinha(posicao = fluxoData.length) {
  const nova = {
    uid: gerarUID(),
    ordem: 0,
    id: "",
    area: "",
    atividade: "",
    tipo: "",
    sistema: "",
    tempo: "",
    coluna: 1,
    linha: 1,
    colunaManual: false,
    linhaManual: false,
    cor: "white",
    proxSim: "",
    proxSimAuto: false,
    proxNao: "",
    extras: []
  };

  fluxoData.splice(posicao, 0, nova);

  reaplicarSugestoesPosicao();
  reaplicarSugestoesConexao(true);
  atualizarTabela();
  salvarEstadoLocal();
}

function excluirLinha(uid) {
  const usada = fluxoData.some(l =>
    l.proxSim === uid ||
    l.proxNao === uid ||
    (Array.isArray(l.extras) && l.extras.includes(uid))
  );

  if (usada) {
    const ok = confirm("Essa etapa está conectada em outras linhas. Se continuar, essas conexões serão removidas. Deseja excluir mesmo?");
    if (!ok) return;
  }

  fluxoData = fluxoData.filter(l => l.uid !== uid);

  fluxoData.forEach(l => {
    if (l.proxSim === uid) {
      l.proxSim = "";
      l.proxSimAuto = false;
    }

    if (l.proxNao === uid) l.proxNao = "";

    if (Array.isArray(l.extras)) {
      l.extras = l.extras.filter(dest => dest !== uid);
    }
  });

  reaplicarSugestoesPosicao();
  reaplicarSugestoesConexao(true);
  atualizarTabela();
  salvarEstadoLocal();
}

function gerarDatalistHTML(campo) {
  const valores = coletarValoresUnicos(campo);

  if (!valores.length) return "";

  const id = `dl-${campo}`;

  return `
    <datalist id="${id}">
      ${valores.map(v => `<option value="${v}"></option>`).join("")}
    </datalist>
  `;
}

function coletarValoresUnicos(campo) {
  const mapa = new Map();

  fluxoData.forEach(l => {
    const valorOriginal = normalizarEspacos(l[campo] || "");
    if (!valorOriginal) return;

    const chave = valorOriginal.toLocaleLowerCase("pt-BR");

    if (!mapa.has(chave)) {
      mapa.set(chave, valorOriginal);
    }
  });

  return Array.from(mapa.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}


function garantirContainerDatalists() {
  let container = document.getElementById("flowDatalists");

  if (!container) {
    container = document.createElement("div");
    container.id = "flowDatalists";
    container.style.display = "none";
    document.body.appendChild(container);
  }

  return container;
}

function renderizarDatalists() {
  const container = garantirContainerDatalists();

  const areasSugestoes = obterValoresUnicosCampo("area");
  const tiposSugestoes = obterValoresUnicosCampo("tipo");
  const sistemasSugestoes = obterValoresUnicosCampo("sistema");

  container.innerHTML = `
    <datalist id="sugestoes-area">
      ${areasSugestoes.map(valor => `<option value="${escaparHTML(valor)}"></option>`).join("")}
    </datalist>

    <datalist id="sugestoes-tipo">
      ${tiposSugestoes.map(valor => `<option value="${escaparHTML(valor)}"></option>`).join("")}
    </datalist>

    <datalist id="sugestoes-sistema">
      ${sistemasSugestoes.map(valor => `<option value="${escaparHTML(valor)}"></option>`).join("")}
    </datalist>
  `;
}

function normalizarEspacos(texto) {
  return String(texto || "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTextoCampo(campo, valor) {
  let texto = normalizarEspacos(valor);

  if (!texto) return "";

  if (campo === "area" || campo === "tipo" || campo === "sistema") {
    const textoLower = texto.toLocaleLowerCase("pt-BR");

    const existente = fluxoData.find(l => {
      const atual = normalizarEspacos(l[campo] || "");
      return atual && atual.toLocaleLowerCase("pt-BR") === textoLower;
    });

    if (existente) {
      return normalizarEspacos(existente[campo] || "");
    }
  }

  return texto;
}

function obterValoresUnicosCampo(campo) {
  const mapa = new Map();

  fluxoData.forEach(l => {
    const valorOriginal = normalizarEspacos(l[campo] || "");
    if (!valorOriginal) return;

    const chave = valorOriginal.toLocaleLowerCase("pt-BR");

    if (!mapa.has(chave)) {
      mapa.set(chave, valorOriginal);
    }
  });

  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function filtrarSugestoesAutocomplete(campo, termo) {
  const sugestoes = obterValoresUnicosCampo(campo);
  const termoNormalizado = normalizarEspacos(termo).toLocaleLowerCase("pt-BR");

  if (!termoNormalizado) {
    return sugestoes.slice(0, 8);
  }

  const comeca = sugestoes.filter(item =>
    item.toLocaleLowerCase("pt-BR").startsWith(termoNormalizado)
  );

  const contem = sugestoes.filter(item =>
    !item.toLocaleLowerCase("pt-BR").startsWith(termoNormalizado) &&
    item.toLocaleLowerCase("pt-BR").includes(termoNormalizado)
  );

  return [...comeca, ...contem].slice(0, 8);
}

function fecharAutocomplete() {
  document.querySelectorAll(".autocomplete-box").forEach(el => el.remove());
  autocompleteState.abertoPara = null;
  autocompleteState.indiceAtivo = -1;
}

function renderizarAutocomplete(uid, campo, inputEl) {
  fecharAutocomplete();

  const sugestoes = filtrarSugestoesAutocomplete(campo, inputEl.value);
  if (!sugestoes.length) return;

  const rect = inputEl.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "autocomplete-box";
  box.dataset.uid = uid;
  box.dataset.campo = campo;

  box.style.position = "fixed";
  box.style.left = rect.left + "px";
  box.style.top = (rect.bottom + 2) + "px";
  box.style.width = rect.width + "px";
  box.style.maxHeight = "220px";
  box.style.overflowY = "auto";
  box.style.background = "#ffffff";
  box.style.border = "1px solid #cfcfcf";
  box.style.borderRadius = "8px";
  box.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  box.style.zIndex = "9999";
  box.style.padding = "4px 0";

  sugestoes.forEach((sugestao, index) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.dataset.index = String(index);
    item.dataset.valor = sugestao;
    item.style.padding = "8px 10px";
    item.style.cursor = "pointer";
    item.style.fontFamily = "Arial, sans-serif";
    item.style.fontSize = "14px";
    item.style.lineHeight = "1.2";
    item.textContent = sugestao;

    item.addEventListener("mouseenter", () => {
      atualizarItemAtivoAutocomplete(box, index);
    });

    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selecionarSugestaoAutocomplete(uid, campo, sugestao);
    });

    box.appendChild(item);
  });

  document.body.appendChild(box);
  autocompleteState.abertoPara = `${uid}__${campo}`;
  autocompleteState.indiceAtivo = 0;
  atualizarItemAtivoAutocomplete(box, 0);
}

function atualizarItemAtivoAutocomplete(box, indice) {
  const itens = Array.from(box.querySelectorAll(".autocomplete-item"));
  if (!itens.length) return;

  itens.forEach((item, i) => {
    item.style.background = i === indice ? "#eaf3ff" : "#ffffff";
  });

  autocompleteState.indiceAtivo = indice;

  const ativo = itens[indice];
  if (ativo) {
    ativo.scrollIntoView({ block: "nearest" });
  }
}

function obterCamposNavegaveisTabela() {
  const tbody = document.getElementById("tbodyFluxo");
  if (!tbody) return [];

  const ordemCampos = [
    "area",
    "atividade",
    "tipo",
    "sistema",
    "tempo",
    "coluna",
    "linha",
    "cor",
    "proxSim",
    "proxNao"
  ];

  const campos = Array.from(
    tbody.querySelectorAll(".flow-input[data-uid][data-campo]")
  ).filter(el => {
    return (
      el.offsetParent !== null &&
      !el.disabled &&
      !el.readOnly &&
      el.tabIndex !== -1
    );
  });

  campos.sort((a, b) => {
    const uidA = a.dataset.uid;
    const uidB = b.dataset.uid;

    const linhaA = fluxoData.findIndex(l => l.uid === uidA);
    const linhaB = fluxoData.findIndex(l => l.uid === uidB);

    if (linhaA !== linhaB) return linhaA - linhaB;

    const campoA = ordemCampos.indexOf(a.dataset.campo || "");
    const campoB = ordemCampos.indexOf(b.dataset.campo || "");

    return campoA - campoB;
  });

  return campos;
}

function focarProximoCampoTabela(uid, campo, voltar = false) {
  const campos = obterCamposNavegaveisTabela();
  if (!campos.length) return;

  const campoAtual = campos.find(el =>
    el.dataset.uid === uid && el.dataset.campo === campo
  );

  if (!campoAtual) return;

  const indiceAtual = campos.indexOf(campoAtual);
  if (indiceAtual === -1) return;

  const proximoIndice = voltar ? indiceAtual - 1 : indiceAtual + 1;
  if (proximoIndice < 0 || proximoIndice >= campos.length) return;

  const proximoCampo = campos[proximoIndice];
  proximoCampo.focus();

  if (
    typeof proximoCampo.select === "function" &&
    proximoCampo.tagName === "INPUT" &&
    proximoCampo.type !== "number"
  ) {
    proximoCampo.select();
  }
}

function focarCampoEspecifico(uid, campo) {
  const el = document.querySelector(
    `.flow-input[data-uid="${uid}"][data-campo="${campo}"]`
  );

  if (!el) return;

  el.focus();

  if (
    typeof el.select === "function" &&
    el.tagName === "INPUT" &&
    el.type !== "number"
  ) {
    el.select();
  }
}

function selecionarSugestaoAutocomplete(uid, campo, valor, manterFocoNoMesmoCampo = true) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  const valorNormalizado = normalizarTextoCampo(campo, valor);
  linha[campo] = valorNormalizado;

  if (campo === "area") {
    reaplicarSugestoesPosicao();
  }

  atualizarTabela();

  if (manterFocoNoMesmoCampo) {
    const novoInput = document.querySelector(
      `.flow-input[data-uid="${uid}"][data-campo="${campo}"]`
    );

    if (novoInput) {
      novoInput.focus();
      if (typeof novoInput.setSelectionRange === "function") {
        const fim = novoInput.value.length;
        novoInput.setSelectionRange(fim, fim);
      }
    }
  }

  fecharAutocomplete();
  atualizarOpcoesDeConexao();
  salvarEstadoLocal();
}

function tratarAutocompleteKeydown(event, uid, campo) {
  const box = document.querySelector(`.autocomplete-box[data-uid="${uid}"][data-campo="${campo}"]`);
  const itens = box ? Array.from(box.querySelectorAll(".autocomplete-item")) : [];

  if (event.key === "ArrowDown" && box && itens.length) {
    event.preventDefault();
    event.stopPropagation();
    const novoIndice = Math.min(autocompleteState.indiceAtivo + 1, itens.length - 1);
    atualizarItemAtivoAutocomplete(box, novoIndice);
    return;
  }

  if (event.key === "ArrowUp" && box && itens.length) {
    event.preventDefault();
    event.stopPropagation();
    const novoIndice = Math.max(autocompleteState.indiceAtivo - 1, 0);
    atualizarItemAtivoAutocomplete(box, novoIndice);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();

    const linha = fluxoData.find(l => l.uid === uid);
    if (!linha) return;

    const inputAtual = document.querySelector(
      `.flow-input[data-uid="${uid}"][data-campo="${campo}"]`
    );

    let valorFinal = inputAtual ? inputAtual.value : "";

    if (box && itens.length) {
      const itemAtivo = itens[autocompleteState.indiceAtivo];
      if (itemAtivo && itemAtivo.dataset.valor) {
        valorFinal = itemAtivo.dataset.valor;
      }
    }

    valorFinal = normalizarTextoCampo(campo, valorFinal);
    linha[campo] = valorFinal;

    fecharAutocomplete();
    atualizarOpcoesDeConexao();
    salvarEstadoLocal();

    if (campo === "area") {
      ignorarBlurAutocomplete = true;

      reaplicarSugestoesPosicao();
      atualizarTabela();

      requestAnimationFrame(() => {
        const destino = document.querySelector(
          `.flow-input[data-uid="${uid}"][data-campo="atividade"]`
        );

        if (destino) {
          destino.focus();
          if (typeof destino.select === "function") {
            destino.select();
          }
        }

        setTimeout(() => {
          ignorarBlurAutocomplete = false;
        }, 200);
      });

      return false;
    }

    if (box && itens.length) {
      selecionarSugestaoAutocomplete(uid, campo, valorFinal, true);
      return false;
    }

    return false;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    fecharAutocomplete();
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();

    const linha = fluxoData.find(l => l.uid === uid);
    if (!linha) return;

    const inputAtual = document.querySelector(
      `.flow-input[data-uid="${uid}"][data-campo="${campo}"]`
    );

    let valorFinal = inputAtual ? inputAtual.value : "";

    if (box && itens.length) {
      const itemAtivo = itens[autocompleteState.indiceAtivo];
      if (itemAtivo && itemAtivo.dataset.valor) {
        valorFinal = itemAtivo.dataset.valor;
      }
    }

    valorFinal = normalizarTextoCampo(campo, valorFinal);
    linha[campo] = valorFinal;

    fecharAutocomplete();
    atualizarOpcoesDeConexao();
    salvarEstadoLocal();

    if (campo === "area") {
      ignorarBlurAutocomplete = true;

      reaplicarSugestoesPosicao();
      atualizarTabela();

      requestAnimationFrame(() => {
        const destino = document.querySelector(
          `.flow-input[data-uid="${uid}"][data-campo="atividade"]`
        );

        if (destino) {
          destino.focus();
          if (typeof destino.select === "function") {
            destino.select();
          }
        }

        setTimeout(() => {
          ignorarBlurAutocomplete = false;
        }, 200);
      });

      return false;
    }

    ignorarBlurAutocomplete = true;

    atualizarTabela();

    requestAnimationFrame(() => {
      focarProximoCampoTabela(uid, campo, event.shiftKey);

      setTimeout(() => {
        ignorarBlurAutocomplete = false;
      }, 200);
    });

    return false;
  }
}

function onInputAutocomplete(uid, campo, valor, elemento) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  linha[campo] = valor;
  salvarEstadoLocal();

  const valorNormalizado = normalizarEspacos(valor);
  if (!valorNormalizado) {
    fecharAutocomplete();
    return;
  }

  renderizarAutocomplete(uid, campo, elemento);
}

function onFocusAutocomplete(uid, campo, elemento) {
  const valorNormalizado = normalizarEspacos(elemento.value);
  if (valorNormalizado) {
    renderizarAutocomplete(uid, campo, elemento);
  }
}

function onBlurAutocomplete(uid, campo, elemento) {
  setTimeout(() => {
    if (ignorarBlurAutocomplete) return;

    const valorNormalizado = normalizarTextoCampo(campo, elemento.value);
    const linha = fluxoData.find(l => l.uid === uid);
    if (!linha) return;

    linha[campo] = valorNormalizado;

    if (campo === "area") {
      reaplicarSugestoesPosicao();
      atualizarTabela();
    } else {
      elemento.value = valorNormalizado;
    }

    fecharAutocomplete();
    atualizarOpcoesDeConexao();
    salvarEstadoLocal();
  }, 120);
}

function atualizarTabela() {
  const tbody = document.getElementById("tbodyFluxo");
  if (!tbody) return;

  fecharAutocomplete();
  tbody.innerHTML = "";

  fluxoData.forEach((linha, index) => {
    const ordem = index + 1;
    const id = gerarIdVisual(index);

    linha.ordem = ordem;
    linha.id = id;

    const tr = document.createElement("tr");
    tr.dataset.uid = linha.uid;

    tr.innerHTML = `
      <td>
        <input
          class="flow-input"
          autocomplete="off"
          data-uid="${linha.uid}"
          data-campo="area"
          value="${escaparHTML(linha.area || "")}"
          oninput="onInputAutocomplete('${linha.uid}','area',this.value,this)"
          onfocus="onFocusAutocomplete('${linha.uid}','area',this)"
          onblur="onBlurAutocomplete('${linha.uid}','area',this)"
          onkeydown="tratarAutocompleteKeydown(event,'${linha.uid}','area')"
        >
      </td>

      <td>
        <input
          class="flow-input"
          data-uid="${linha.uid}"
          data-campo="atividade"
          value="${escaparHTML(linha.atividade || "")}"
          oninput="updateCampo('${linha.uid}','atividade',this.value)"
          onblur="aoSairCampoLinha('${linha.uid}')"
        >
      </td>

      <td>
        <input
          class="flow-input"
          autocomplete="off"
          data-uid="${linha.uid}"
          data-campo="tipo"
          value="${escaparHTML(linha.tipo || "")}"
          oninput="onInputAutocomplete('${linha.uid}','tipo',this.value,this)"
          onfocus="onFocusAutocomplete('${linha.uid}','tipo',this)"
          onblur="onBlurAutocomplete('${linha.uid}','tipo',this)"
          onkeydown="tratarAutocompleteKeydown(event,'${linha.uid}','tipo')"
        >
      </td>

      <td>
        <input
          class="flow-input"
          autocomplete="off"
          data-uid="${linha.uid}"
          data-campo="sistema"
          value="${escaparHTML(linha.sistema || "")}"
          oninput="onInputAutocomplete('${linha.uid}','sistema',this.value,this)"
          onfocus="onFocusAutocomplete('${linha.uid}','sistema',this)"
          onblur="onBlurAutocomplete('${linha.uid}','sistema',this)"
          onkeydown="tratarAutocompleteKeydown(event,'${linha.uid}','sistema')"
        >
      </td>

      <td>
        <input
          class="flow-input"
          data-uid="${linha.uid}"
          data-campo="tempo"
          value="${escaparHTML(linha.tempo || "")}"
          oninput="updateCampo('${linha.uid}','tempo',this.value)"
        >
      </td>

      <td>
        <select
          class="flow-input"
          data-uid="${linha.uid}"
          data-campo="cor"
          onchange="updateCampo('${linha.uid}','cor',this.value)"
        >
          <option value="white" ${linha.cor === "white" ? "selected" : ""}>Branco</option>
          <option value="blue" ${linha.cor === "blue" ? "selected" : ""}>Azul</option>
          <option value="green" ${linha.cor === "green" ? "selected" : ""}>Verde</option>
          <option value="yellow" ${linha.cor === "yellow" ? "selected" : ""}>Amarelo</option>
          <option value="red" ${linha.cor === "red" ? "selected" : ""}>Vermelho</option>
        </select>
      </td>

      <td class="cel-nao" data-decisao="${ehDecisao(linha) ? "1" : "0"}">${ehDecisao(linha) ? criarSelectConexao(linha.uid, linha.proxNao, "proxNao") : '<span class="cel-vazia">&mdash;</span>'}</td>

      <td class="acoes-btn">
        <button type="button" class="btn-small" tabindex="-1" onclick="adicionarLinha(${index})">↑ inserir</button>
        <button type="button" class="btn-small" tabindex="-1" onclick="adicionarLinha(${index + 1})">↓ inserir</button>
        <button type="button" class="btn-small" tabindex="-1" onclick="excluirLinha('${linha.uid}')">Excluir</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  atualizarOpcoesDeConexao();
}

function aoSairCampoLinha(uid) {
  // Re-renderiza a tabela apenas quando o "status de decisão" da linha muda,
  // para a célula "Não" aparecer/sumir sem perder o foco durante a digitação.
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;
  const cel = document.querySelector(`#tbodyFluxo tr[data-uid="${uid}"] .cel-nao`);
  if (!cel) return;
  const novo = ehDecisao(linha) ? "1" : "0";
  if (cel.getAttribute("data-decisao") !== novo) {
    atualizarTabela();
  }
}

function criarSelectConexao(uidAtual, valorSelecionado, campo) {
  const linhaAtual = fluxoData.find(l => l.uid === uidAtual);
  const ehAuto = campo === "proxSim" && linhaAtual && linhaAtual.proxSimAuto;

  let options = `<option value="">-</option>`;

  fluxoData.forEach(l => {
    if (l.uid === uidAtual) return;

    const label = `${l.id || ""} - ${l.atividade || "(sem nome)"}`;
    options += `<option value="${l.uid}" ${valorSelecionado === l.uid ? "selected" : ""}>${escaparHTML(label)}</option>`;
  });

  if (!campo) {
    return `<select class="flow-input conexao-select" data-uid="${uidAtual}">${options}</select>`;
  }

  const onKeydownExtra =
    campo === "proxNao"
      ? `onkeydown="tratarTabCampo(event,'${uidAtual}','${campo}')"`
      : "";

  const estiloAuto = ehAuto
    ? `style="background:#eef6ff;border:1px solid #7aa7e0;"`
    : "";

  const tituloAuto = ehAuto
    ? `title="Preenchido automaticamente com a próxima atividade"`
    : "";

  return `
    <select
      class="flow-input conexao-select ${ehAuto ? "conexao-auto" : ""}"
      data-uid="${uidAtual}"
      data-campo="${campo}"
      onchange="updateCampo('${uidAtual}','${campo}',this.value)"
      ${onKeydownExtra}
      ${estiloAuto}
      ${tituloAuto}
    >
      ${options}
    </select>
  `;
}

function atualizarOpcoesDeConexao() {
  const selects = document.querySelectorAll("#tbodyFluxo select.conexao-select");

  selects.forEach(select => {
    const uidAtual = select.dataset.uid;
    const campo = select.dataset.campo || "";
    const valorAtual = select.value;

    let options = `<option value="">-</option>`;

    fluxoData.forEach(l => {
      if (l.uid === uidAtual) return;

      const label = `${l.id || ""} - ${l.atividade || "(sem nome)"}`;
      options += `<option value="${l.uid}" ${valorAtual === l.uid ? "selected" : ""}>${escaparHTML(label)}</option>`;
    });

    select.innerHTML = options;

    if (valorAtual) {
      select.value = valorAtual;
    }

    if (campo && select.value !== valorAtual) {
      const linha = fluxoData.find(l => l.uid === uidAtual);
      if (linha) {
        linha[campo] = select.value || "";
      }
    }
  });
}

function addExtra(uid) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  if (!Array.isArray(linha.extras)) {
    linha.extras = [];
  }

  linha.extras.push("");
  atualizarTabela();
  salvarEstadoLocal();
}

function renderExtras(linha) {
  const div = document.getElementById("extras_" + linha.uid);
  if (!div) return;

  div.innerHTML = "";

  if (!Array.isArray(linha.extras)) {
    linha.extras = [];
  }

  linha.extras.forEach((val, i) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "4px";
    wrapper.style.marginBottom = "4px";

    wrapper.innerHTML = `
      ${criarSelectConexao(linha.uid, val, null)}
      <button type="button" class="btn-small" tabindex="-1" onclick="removeExtra('${linha.uid}', ${i})">x</button>
    `;

    const select = wrapper.querySelector("select");
    if (select) {
      select.onchange = (e) => {
        linha.extras[i] = e.target.value;
      };
    }

    div.appendChild(wrapper);
  });
}

function removeExtra(uid, index) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha || !Array.isArray(linha.extras)) return;

  linha.extras.splice(index, 1);
  atualizarTabela();
  salvarEstadoLocal();
}

function updateCampo(uid, campo, valor, reRender = false) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  if (campo === "coluna" || campo === "linha") {
    const flagManual = campo === "coluna" ? "colunaManual" : "linhaManual";

    if (valor === "" || valor === null || valor === undefined) {
      linha[flagManual] = false;
      reaplicarSugestoesPosicao();
      atualizarTabela();
      salvarEstadoLocal();
      return;
    }

    linha[campo] = Math.max(1, Number(valor) || 1);
    linha[flagManual] = true;

    const areaNormalizada = normalizarEspacos(linha.area || "");
    const linhaEfetiva = Math.max(1, Number(linha.linha) || 1);
    const colunaEfetiva = Math.max(1, Number(linha.coluna) || 1);

    if (
      areaNormalizada &&
      existePosicaoOcupadaNaRaia(uid, areaNormalizada, linhaEfetiva, colunaEfetiva)
    ) {
      const proximaLivre = obterProximaColunaLivreNaRaia(
        uid,
        areaNormalizada,
        linhaEfetiva,
        colunaEfetiva
      );

      mostrarToast(
        `Já existe atividade na área "${areaNormalizada}" (linha ${linhaEfetiva}, coluna ${colunaEfetiva}). ` +
        `Coluna ajustada automaticamente para ${proximaLivre}.`,
        "alerta"
      );

      linha.coluna = proximaLivre;
      linha.colunaManual = true;
    }

    reaplicarSugestoesPosicao();
    atualizarTabela();
    salvarEstadoLocal();
    return;
  }

  if (campo === "area" || campo === "tipo" || campo === "sistema") {
    linha[campo] = valor;
    salvarEstadoLocal();
    return;
  }

  if (campo === "proxSim") {
    linha.proxSim = valor || "";
    linha.proxSimAuto = false;
    atualizarTabela();
    salvarEstadoLocal();
    return;
  }

  linha[campo] = valor;

  if (reRender) {
    atualizarTabela();
    salvarEstadoLocal();
    return;
  }

  if (campo === "atividade") {
    atualizarOpcoesDeConexao();
    salvarEstadoLocal();
    return;
  }

  salvarEstadoLocal();
}

function finalizarCampoNormalizado(uid, campo, elemento) {
  const linha = fluxoData.find(l => l.uid === uid);
  if (!linha) return;

  const valorNormalizado = normalizarTextoCampo(campo, elemento.value);

  linha[campo] = valorNormalizado;
  elemento.value = valorNormalizado;

  renderizarDatalists();
  atualizarOpcoesDeConexao();
}

function configurarNavegacaoTabTabela() {
  const tbody = document.getElementById("tbodyFluxo");
  if (!tbody || tbody.dataset.tabConfigurado === "1") return;

  tbody.dataset.tabConfigurado = "1";

  tbody.addEventListener("keydown", (event) => {
    const tecla = event.key;
    if (tecla !== "Tab" && tecla !== "Enter") return;

    const campoAtual = event.target;
    if (!(campoAtual instanceof HTMLElement)) return;
    if (!campoAtual.matches(".flow-input")) return;

    const uid = campoAtual.dataset.uid || "";
    const campo = campoAtual.dataset.campo || "";
    if (!uid || !campo) return;

    // campos com autocomplete já têm tratamento próprio
    if (campo === "area" || campo === "tipo" || campo === "sistema") {
      return;
    }

    const voltar = tecla === "Tab" && event.shiftKey;

    // Enter se comporta como avanço, exceto quando Shift+Tab volta
    if (campo === "proxNao") {
      if (voltar) return;

      event.preventDefault();
      event.stopPropagation();
      irParaProximaLinhaOuCriar(uid);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // garante persistência do valor atual antes de trocar foco
    if (campoAtual.tagName === "SELECT") {
      updateCampo(uid, campo, campoAtual.value);
    } else {
      updateCampo(uid, campo, campoAtual.value);
    }

    requestAnimationFrame(() => {
      focarProximoCampoTabela(uid, campo, voltar);
    });
  });
}

function irParaProximaLinhaOuCriar(uid) {
  const indiceAtual = fluxoData.findIndex(l => l.uid === uid);
  if (indiceAtual === -1) return;

  let proximaLinha = fluxoData[indiceAtual + 1];

  if (!proximaLinha) {
    adicionarLinha(indiceAtual + 1);
    proximaLinha = fluxoData[indiceAtual + 1];
  } else {
    atualizarTabela();
  }

  requestAnimationFrame(() => {
    const proximoCampo = document.querySelector(
      `.flow-input[data-uid="${proximaLinha.uid}"][data-campo="area"]`
    );

    if (proximoCampo) {
      proximoCampo.focus();

      if (
        typeof proximoCampo.select === "function" &&
        proximoCampo.tagName === "INPUT"
      ) {
        proximoCampo.select();
      }
    }
  });
}

function tratarTabCampo(event, uid, campo) {
  const tecla = event.key;
  const ehTab = tecla === "Tab";
  const ehEnter = tecla === "Enter";

  if ((!ehTab && !ehEnter) || event.shiftKey) return;

  if (campo === "proxNao") {
    event.preventDefault();
    event.stopPropagation();
    irParaProximaLinhaOuCriar(uid);
  }
}

function importarExcelDeTexto(texto) {
  // Núcleo compartilhado (textarea legado + import por arquivo).
  // Remove BOM do arquivo exportado, senão o cabeçalho não é detectado.
  texto = String(texto == null ? "" : texto).replace(/^\uFEFF/, "").trim();

  if (!texto) {
    mostrarToast("Nenhum conteúdo para importar.", "alerta");
    return;
  }

  const linhasBrutas = texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim() !== "");

  let linhas = linhasBrutas.map(l => l.split("\t"));

  if (linhas.length && ehCabecalho(linhas[0])) {
    linhas.shift();
  }

  fluxoData = [];
  uidCounter = 1;

  linhas.forEach((col) => {
    while (col.length < 13) col.push("");

    const area = limpar(col[2]) || "Sem Área";
    const atividade = limpar(col[3]);
    const tipo = limpar(col[4]) || "Não informado";
    const sistema = limpar(col[5]) || "Sem sistema informado";
    const tempo = limpar(col[6]);
    const proxSimOriginal = limpar(col[7]);
    const proxNaoOriginal = limpar(col[8]);
    const conexoesExtrasOriginal = limpar(col[9]);
    const coluna = Number(limpar(col[10])) || 1;
    const linha = Number(limpar(col[11])) || 1;
    const cor = normalizarCor(col[12]);

    if (!atividade) return;

    fluxoData.push({
      uid: gerarUID(),
      ordem: 0,
      id: "",
      area,
      atividade,
      tipo,
      sistema,
      tempo,
      coluna,
      linha,
      colunaManual: true,
      linhaManual: true,
      cor,
      proxSimOriginal,
      proxNaoOriginal,
      conexoesExtrasOriginal,
      proxSim: "",
      proxSimAuto: false,
      proxNao: "",
      extras: []
    });
  });

  atualizarTabela();

  const mapaIdVisualParaUid = {};
  fluxoData.forEach((linha) => {
    mapaIdVisualParaUid[linha.id] = linha.uid;
  });

  fluxoData.forEach((linha) => {
    linha.proxSim = mapaIdVisualParaUid[linha.proxSimOriginal] || "";
    linha.proxNao = mapaIdVisualParaUid[linha.proxNaoOriginal] || "";
    linha.extras = quebrarListaIds(linha.conexoesExtrasOriginal)
      .map(id => mapaIdVisualParaUid[id] || "")
      .filter(Boolean);

    // mantém exatamente o que veio do Excel:
    // se houver proxSim preenchido, considera manual;
    // se vier vazio, deixa vazio sem autoajuste
    linha.proxSimAuto = false;

    delete linha.proxSimOriginal;
    delete linha.proxNaoOriginal;
    delete linha.conexoesExtrasOriginal;
  });

  // Onda 3: garante "Sim = próxima" para caixas importadas sem "Próxima".
  reaplicarSugestoesConexao(true);

  atualizarTabela();
  salvarEstadoLocal(true);
  mostrarToast("Tabela importada. Clique em GERAR FLUXO para visualizar.", "ok");
}

// Compat: importa do textarea, se ainda existir na página.
function importarExcel() {
  const entrada = document.getElementById("entrada");
  importarExcelDeTexto(entrada ? entrada.value : "");
}

// Importa a partir de um ARQUIVO de texto (TSV/CSV ou o .xls exportado pela ferramenta).
function importarExcelArquivo(event) {
  const input = event && event.target ? event.target : null;
  const file = input && input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      importarExcelDeTexto(String(reader.result || ""));
    } catch (erro) {
      console.error("Erro ao importar Excel:", erro);
      mostrarToast("Não foi possível ler o arquivo. Exporte pela ferramenta ou salve como 'Texto (separado por tabulações)'.", "erro");
    } finally {
      if (input) input.value = ""; // permite reimportar o mesmo arquivo
    }
  };
  reader.onerror = () => mostrarToast("Falha ao ler o arquivo.", "erro");
  reader.readAsText(file, "UTF-8");
}

function limpar(txt) {
  if (txt === null || txt === undefined) return "";
  return String(txt)
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

