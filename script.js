let ultimoNomeArquivo = "fluxograma_processo";

let fluxoData = [];
let uidCounter = 1;
let autocompleteState = {
  abertoPara: null,
  indiceAtivo: -1
};

let ignorarBlurAutocomplete = false;

/* ===== Estado do editor interativo (Onda 2) ===== */
let overridesConexoes = {};   // chave "origemId__destinoId" -> { startSide, endSide }
let ordemRaias = [];          // ordem manual das áreas (raias)
let modoEdicaoAtivo = false;  // modo "Ajustar fluxo" ligado/desligado
let conexaoSelecionada = null;// { origemId, destinoId } em edição
let ultimasAreasOrdenadas = [];// snapshot das raias do último render (para o painel)

const STORAGE_KEY = "gerador_fluxograma_estado_v1";
let saveStateTimeout = null;

function obterEstadoAtual() {
  return {
    topo: {
      desenho: obterValorCampo("desenho"),
      processo: obterValorCampo("processo"),
      analista: obterValorCampo("analista"),
      negocio: obterValorCampo("negocio"),
      area: obterValorCampo("area"),
      gestor: obterValorCampo("gestor"),
      entrada: obterValorCampo("entrada")
    },
    fluxoData: Array.isArray(fluxoData)
      ? fluxoData.map(item => ({
          uid: item.uid || gerarUID(),
          ordem: Number(item.ordem) || 0,
          id: item.id || "",
          area: item.area || "",
          atividade: item.atividade || "",
          tipo: item.tipo || "",
          sistema: item.sistema || "",
          tempo: item.tempo || "",
          coluna: Math.max(1, Number(item.coluna) || 1),
          linha: Math.max(1, Number(item.linha) || 1),
          colunaManual: !!item.colunaManual,
          linhaManual: !!item.linhaManual,
          cor: normalizarCor(item.cor || "white"),
          proxSim: item.proxSim || "",
          proxSimAuto: !!item.proxSimAuto,
          proxNao: item.proxNao || "",
          extras: Array.isArray(item.extras) ? [...item.extras] : []
        }))
      : [],
    uidCounter: Number(uidCounter) || 1,
    ultimoNomeArquivo: ultimoNomeArquivo || "fluxograma_processo",
    overridesConexoes: overridesConexoes && typeof overridesConexoes === "object" ? overridesConexoes : {},
    ordemRaias: Array.isArray(ordemRaias) ? [...ordemRaias] : []
  };
}

function salvarEstadoLocal(imediato = false) {
  const executar = () => {
    try {
      const estado = obterEstadoAtual();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (erro) {
      console.error("Erro ao salvar estado local:", erro);
    }
  };

  if (imediato) {
    if (saveStateTimeout) {
      clearTimeout(saveStateTimeout);
      saveStateTimeout = null;
    }
    executar();
    return;
  }

  if (saveStateTimeout) {
    clearTimeout(saveStateTimeout);
  }

  saveStateTimeout = setTimeout(() => {
    saveStateTimeout = null;
    executar();
  }, 250);
}

function limparEstadoLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (erro) {
    console.error("Erro ao limpar estado local:", erro);
  }
}

function preencherCampoSeExistir(id, valor) {
  const el = document.getElementById(id);
  if (el) {
    el.value = valor || "";
  }
}

function restaurarEstadoLocal() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return false;

    const estado = JSON.parse(bruto);
    if (!estado || typeof estado !== "object") return false;

    const topo = estado.topo || {};

    preencherCampoSeExistir("desenho", topo.desenho || "");
    preencherCampoSeExistir("processo", topo.processo || "");
    preencherCampoSeExistir("analista", topo.analista || "");
    preencherCampoSeExistir("negocio", topo.negocio || "");
    preencherCampoSeExistir("area", topo.area || "");
    preencherCampoSeExistir("gestor", topo.gestor || "");
    preencherCampoSeExistir("entrada", topo.entrada || "");

    fluxoData = Array.isArray(estado.fluxoData)
      ? estado.fluxoData.map(item => ({
          uid: item.uid || gerarUID(),
          ordem: Number(item.ordem) || 0,
          id: item.id || "",
          area: item.area || "",
          atividade: item.atividade || "",
          tipo: item.tipo || "",
          sistema: item.sistema || "",
          tempo: item.tempo || "",
          coluna: Math.max(1, Number(item.coluna) || 1),
          linha: Math.max(1, Number(item.linha) || 1),
          colunaManual: !!item.colunaManual,
          linhaManual: !!item.linhaManual,
          cor: normalizarCor(item.cor || "white"),
          proxSim: item.proxSim || "",
          proxSimAuto: !!item.proxSimAuto,
          proxNao: item.proxNao || "",
          extras: Array.isArray(item.extras) ? [...item.extras] : []
        }))
      : [];

    uidCounter = Math.max(
      Number(estado.uidCounter) || 1,
      fluxoData.length + 1
    );

    ultimoNomeArquivo = estado.ultimoNomeArquivo || "fluxograma_processo";

    overridesConexoes =
      estado.overridesConexoes && typeof estado.overridesConexoes === "object"
        ? estado.overridesConexoes
        : {};
    ordemRaias = Array.isArray(estado.ordemRaias) ? estado.ordemRaias : [];

    if (!fluxoData.length) {
      fluxoData = [];
    }

    // Mantém apenas as sugestões de posição
    reaplicarSugestoesPosicao();

    // NÃO recalcula conexões ao restaurar
    return true;
  } catch (erro) {
    console.error("Erro ao restaurar estado local:", erro);
    return false;
  }
}

function configurarAutoSaveCamposFixos() {
  const ids = ["desenho", "processo", "analista", "negocio", "area", "gestor", "entrada"];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.autosaveConfigurado === "1") return;

    el.dataset.autosaveConfigurado = "1";
    el.addEventListener("input", () => salvarEstadoLocal());
    el.addEventListener("change", () => salvarEstadoLocal());
  });
}

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

    // Se a conexão já era automática, pode atualizar a sugestão
    if (linha.proxSimAuto) {
      linha.proxSim = sugestaoUid;
      linha.proxSimAuto = !!sugestaoUid;
      return;
    }

    // Se a linha ainda não tem nenhuma conexão manual,
    // aplica sugestão automática inicial
    const semConexaoManual =
      !linha.proxSim &&
      !linha.proxNao &&
      (!Array.isArray(linha.extras) || linha.extras.length === 0);

    if (semConexaoManual) {
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

    tr.innerHTML = `
      <td>${ordem}</td>
      <td>${id}</td>

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
        <input
          class="flow-input"
          data-uid="${linha.uid}"
          data-campo="coluna"
          type="number"
          min="1"
          value="${linha.coluna || 1}"
          oninput="updateCampo('${linha.uid}','coluna',this.value)"
        >
      </td>

      <td>
        <input
          class="flow-input"
          data-uid="${linha.uid}"
          data-campo="linha"
          type="number"
          min="1"
          value="${linha.linha || 1}"
          oninput="updateCampo('${linha.uid}','linha',this.value)"
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

      <td>${criarSelectConexao(linha.uid, linha.proxSim, "proxSim")}</td>
      <td>${criarSelectConexao(linha.uid, linha.proxNao, "proxNao")}</td>

      <td>
        <div id="extras_${linha.uid}"></div>
        <button type="button" class="btn-small" tabindex="-1" onclick="addExtra('${linha.uid}')">+ adicionar</button>
      </td>

      <td class="acoes-btn">
        <button type="button" class="btn-small" tabindex="-1" onclick="adicionarLinha(${index})">↑ inserir</button>
        <button type="button" class="btn-small" tabindex="-1" onclick="adicionarLinha(${index + 1})">↓ inserir</button>
        <button type="button" class="btn-small" tabindex="-1" onclick="excluirLinha('${linha.uid}')">Excluir</button>
      </td>
    `;

    tbody.appendChild(tr);
    renderExtras(linha);
  });

  atualizarOpcoesDeConexao();
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

function importarExcel() {
  const entrada = document.getElementById("entrada");
  const texto = entrada ? entrada.value.trim() : "";

  if (!texto) {
    mostrarToast("Cole a tabela do Excel primeiro.", "alerta");
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

  atualizarTabela();
  salvarEstadoLocal(true);
}

function limpar(txt) {
  if (txt === null || txt === undefined) return "";
  return String(txt)
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparHTML(txt) {
  return String(txt || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterValorCampo(id) {
  const el = document.getElementById(id);
  return el ? limpar(el.value) : "";
}

function limparCampo(id) {
  const el = document.getElementById(id);
  if (el) el.value = "";
}

function normalizarCor(cor) {
  const c = limpar(cor).toLowerCase();
  const permitidas = ["blue", "yellow", "green", "red", "white"];
  return permitidas.includes(c) ? c : "white";
}

function corHex(cor) {
  const mapa = {
    white: "#ffffff",
    blue: "#8ecae6",
    yellow: "#ffd166",
    green: "#95d5b2",
    red: "#ef476f"
  };
  return mapa[cor] || "#ffffff";
}

function ehCabecalho(colunas) {
  if (!colunas || colunas.length === 0) return false;
  return limpar(colunas[0]).toLowerCase() === "ordem";
}

function tempoParaSegundos(tempo) {
  if (!tempo) return 0;
  tempo = String(tempo).trim();

  if (!tempo.includes(":")) {
    return (Number(tempo.replace(",", ".")) || 0) * 3600;
  }

  const partes = tempo.split(":");
  const h = Number(partes[0]) || 0;
  const m = Number(partes[1]) || 0;
  const s = Number(partes[2]) || 0;

  return h * 3600 + m * 60 + s;
}

function segundosParaTempo(seg) {
  seg = Math.round(Number(seg) || 0);
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;

  return (
    String(h).padStart(2, "0") + ":" +
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0")
  );
}

function formatarTempo(seg) {
  return segundosParaTempo(seg);
}

function formatarTempoEtapa(etapa) {
  const tempoTexto = limpar(etapa?.tempoTexto ?? "");

  if (!tempoTexto) return "";

  return segundosParaTempo(tempoParaSegundos(tempoTexto));
}

function formatarPercentual(valor) {
  return (Number(valor) || 0).toFixed(1).replace(".", ",");
}

function quebrarListaIds(valor) {
  return String(valor || "")
    .split(",")
    .map(item => limpar(item))
    .filter(Boolean);
}

function destinoEhValido(destinoId, idsValidos) {
  return !!destinoId && idsValidos.has(destinoId);
}

function criarElementoSVG(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function isPergunta(texto) {
  return limpar(texto).endsWith("?");
}

function medirLarguraTexto(texto, fontSize = CONFIG.fontSize, fontWeight = "normal") {
  const svgMedicao = criarElementoSVG("svg");
  svgMedicao.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgMedicao.setAttribute("width", "0");
  svgMedicao.setAttribute("height", "0");
  svgMedicao.setAttribute(
    "style",
    "position:absolute;left:-9999px;top:-9999px;visibility:hidden;overflow:hidden;"
  );

  const text = criarElementoSVG("text");
  text.setAttribute("font-family", CONFIG.fontFamily);
  text.setAttribute("font-size", String(fontSize));
  text.setAttribute("font-weight", fontWeight);
  text.textContent = texto || "";
  svgMedicao.appendChild(text);

  document.body.appendChild(svgMedicao);
  const largura = text.getComputedTextLength();
  document.body.removeChild(svgMedicao);

  return largura;
}

function quebrarTextoPorLargura(texto, larguraMaxima, fontSize = CONFIG.fontSize, fontWeight = "normal") {
  const textoLimpo = String(texto || "").trim();
  if (!textoLimpo) return [];

  const palavras = textoLimpo.split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];

  const linhas = [];
  let linhaAtual = "";

  for (const palavra of palavras) {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;

    if (medirLarguraTexto(tentativa, fontSize, fontWeight) <= larguraMaxima) {
      linhaAtual = tentativa;
      continue;
    }

    if (linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = "";
    }

    if (medirLarguraTexto(palavra, fontSize, fontWeight) <= larguraMaxima) {
      linhaAtual = palavra;
      continue;
    }

    let parteAtual = "";

    for (const caractere of palavra) {
      const tentativaParte = parteAtual + caractere;

      if (medirLarguraTexto(tentativaParte, fontSize, fontWeight) <= larguraMaxima) {
        parteAtual = tentativaParte;
      } else {
        if (parteAtual) linhas.push(parteAtual);
        parteAtual = caractere;
      }
    }

    if (parteAtual) {
      linhaAtual = parteAtual;
    }
  }

  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

function obterLarguraNo(etapa) {
  return ehDecisao(etapa) ? CONFIG.decisionWidth : CONFIG.boxWidth;
}

function obterLarguraUtilTexto(etapa, larguraCaixa) {
  if (ehDecisao(etapa)) {
    return Math.max(40, larguraCaixa * CONFIG.decisionTextWidthFactor);
  }

  return Math.max(60, larguraCaixa - CONFIG.rectTextPaddingHorizontal * 2);
}

function obterLinhasEtapa(etapa, larguraCaixa) {
  const larguraTexto = obterLarguraUtilTexto(etapa, larguraCaixa);

  const linhasAtividade = quebrarTextoPorLargura(
    etapa.atividade,
    larguraTexto,
    CONFIG.fontSize
  );

  const linhaTempo = formatarTempoEtapa(etapa);

  return linhaTempo
    ? [...linhasAtividade, linhaTempo]
    : [...linhasAtividade];
}

function desenharSistemaSeparado(svg, etapa, pos) {
  const altura = 24;
  const y = pos.y + pos.h - altura;

  const g = criarElementoSVG("g");

  const rect = criarElementoSVG("rect");
  rect.setAttribute("x", pos.x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", pos.w);
  rect.setAttribute("height", altura);
  rect.setAttribute("class", "system");
  g.appendChild(rect);

  const text = criarElementoSVG("text");
  text.setAttribute("x", pos.x + pos.w / 2);
  text.setAttribute("y", y + 16);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", CONFIG.fontFamily);
  text.setAttribute("font-size", CONFIG.smallFontSize);
  text.setAttribute("fill", "#111111");
  text.textContent = etapa.sistema || "Sem sistema";

  g.appendChild(text);
  svg.appendChild(g);
}

function desenharTextoMultilinhaSVG(g, linhas, x, yInicial, fontSize, lineHeight, fill = "#111111", fontWeight = "normal") {
  const text = criarElementoSVG("text");
  text.setAttribute("x", x);
  text.setAttribute("y", yInicial);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", CONFIG.fontFamily);
  text.setAttribute("font-size", String(fontSize));
  text.setAttribute("font-weight", fontWeight);
  text.setAttribute("fill", fill);
  text.setAttribute("xml:space", "preserve");

  linhas.forEach((linha, i) => {
    const tspan = criarElementoSVG("tspan");
    tspan.setAttribute("x", x);
    if (i === 0) {
      tspan.setAttribute("dy", "0");
    } else {
      tspan.setAttribute("dy", String(lineHeight));
    }
    tspan.textContent = linha;
    text.appendChild(tspan);
  });

  g.appendChild(text);
}

function desenharNoExcel(svg, etapa, pos) {
  const g = criarElementoSVG("g");
  const pergunta = ehDecisao(etapa);

  if (pergunta) {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;

    const polygon = criarElementoSVG("polygon");
    polygon.setAttribute(
      "points",
      `${cx},${pos.y} ${pos.x + pos.w},${cy} ${cx},${pos.y + pos.h} ${pos.x},${cy}`
    );
    polygon.setAttribute("fill", corHex(etapa.cor));
    polygon.setAttribute("stroke", "#111111");
    polygon.setAttribute("stroke-width", "2");
    g.appendChild(polygon);

    const linhas = obterLinhasEtapa(etapa, pos.w);
    const totalAlturaTexto = linhas.length * CONFIG.textLineHeight;
    const inicioYTexto = pos.y + (pos.h - totalAlturaTexto) / 2 + 14;

    desenharTextoMultilinhaSVG(
      g,
      linhas,
      pos.x + pos.w / 2,
      inicioYTexto,
      CONFIG.fontSize,
      CONFIG.textLineHeight,
      "#111111"
    );
  } else {
    const alturaSistema = 24;
    const ySeparador = pos.y + pos.h - alturaSistema;

    const rectPrincipal = criarElementoSVG("rect");
    rectPrincipal.setAttribute("x", pos.x);
    rectPrincipal.setAttribute("y", pos.y);
    rectPrincipal.setAttribute("width", pos.w);
    rectPrincipal.setAttribute("height", pos.h);
    rectPrincipal.setAttribute("fill", corHex(etapa.cor));
    rectPrincipal.setAttribute("stroke", "#111111");
    rectPrincipal.setAttribute("stroke-width", "2");
    g.appendChild(rectPrincipal);

    const linhaSeparadora = criarElementoSVG("line");
    linhaSeparadora.setAttribute("x1", pos.x);
    linhaSeparadora.setAttribute("y1", ySeparador);
    linhaSeparadora.setAttribute("x2", pos.x + pos.w);
    linhaSeparadora.setAttribute("y2", ySeparador);
    linhaSeparadora.setAttribute("stroke", "#111111");
    linhaSeparadora.setAttribute("stroke-width", "1.5");
    g.appendChild(linhaSeparadora);

    const linhasAtividade = quebrarTextoPorLargura(
      etapa.atividade,
      obterLarguraUtilTexto(etapa, pos.w),
      CONFIG.fontSize
    );

    const linhaTempo = formatarTempoEtapa(etapa);

    const areaUtil = pos.h - alturaSistema - 6;
    const totalAlturaTexto =
      (linhasAtividade.length * CONFIG.textLineHeight) +
      (linhaTempo ? CONFIG.textLineHeight : 0);

    const inicioYTexto = pos.y + (areaUtil - totalAlturaTexto) / 2 + 14;

    linhasAtividade.forEach((linha, i) => {
      const text = criarElementoSVG("text");
      text.setAttribute("x", pos.x + pos.w / 2);
      text.setAttribute("y", inicioYTexto + i * CONFIG.textLineHeight);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", CONFIG.fontFamily);
      text.setAttribute("font-size", String(CONFIG.fontSize));
      text.setAttribute("fill", "#111111");
      text.setAttribute("xml:space", "preserve");
      text.textContent = linha;
      g.appendChild(text);
    });

    if (linhaTempo) {
      const textTempo = criarElementoSVG("text");
      textTempo.setAttribute("x", pos.x + pos.w / 2);
      textTempo.setAttribute("y", inicioYTexto + linhasAtividade.length * CONFIG.textLineHeight);
      textTempo.setAttribute("text-anchor", "middle");
      textTempo.setAttribute("font-family", CONFIG.fontFamily);
      textTempo.setAttribute("font-size", String(CONFIG.smallFontSize));
      textTempo.setAttribute("fill", "#111111");
      textTempo.setAttribute("xml:space", "preserve");
      textTempo.textContent = linhaTempo;
      g.appendChild(textTempo);
    }

    const textoSistema = criarElementoSVG("text");
    textoSistema.setAttribute("x", pos.x + pos.w / 2);
    textoSistema.setAttribute("y", ySeparador + 16);
    textoSistema.setAttribute("text-anchor", "middle");
    textoSistema.setAttribute("font-family", CONFIG.fontFamily);
    textoSistema.setAttribute("font-size", String(CONFIG.smallFontSize));
    textoSistema.setAttribute("fill", "#111111");
    textoSistema.setAttribute("xml:space", "preserve");
    textoSistema.textContent = etapa.sistema || "Sem sistema";
    g.appendChild(textoSistema);
  }

  svg.appendChild(g);
}

function obterAlturaNo(etapa, alturaPadraoBase) {
  const alturaSistema = 24;

  if (ehDecisao(etapa)) {
    return Math.ceil(alturaPadraoBase * CONFIG.decisionHeightFactor) + alturaSistema;
  }

  return alturaPadraoBase + alturaSistema;
}

function calcularAlturaNecessariaEtapa(etapa) {
  const largura = obterLarguraNo(etapa);
  const linhas = obterLinhasEtapa(etapa, largura);

  const alturaTexto = linhas.length * CONFIG.textLineHeight;
  const alturaNecessaria = alturaTexto + CONFIG.textPaddingVertical * 2;

  if (ehDecisao(etapa)) {
    return Math.max(CONFIG.boxHeight, Math.ceil(alturaNecessaria / CONFIG.decisionHeightFactor));
  }

  return Math.max(CONFIG.boxHeight, alturaNecessaria);
}

function calcularAlturaPadraoNos(etapas) {
  let maiorAltura = CONFIG.boxHeight;

  etapas.forEach((etapa) => {
    const altura = calcularAlturaNecessariaEtapa(etapa);
    if (altura > maiorAltura) {
      maiorAltura = altura;
    }
  });

  return maiorAltura;
}

function gerarNomeArquivo() {
  const processo = limpar(document.getElementById("processo").value) || "fluxograma";
  return processo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "fluxograma_processo";
}

function baixarTemplateExcel() {
  if (!fluxoData.length) {
    mostrarToast("Não há etapas para exportar.", "alerta");
    return;
  }

  const cabecalho = [
    "Ordem",
    "ID",
    "Área",
    "Atividade",
    "Tipo",
    "Sistema",
    "Tempo",
    "Próx Sim",
    "Próx Não",
    "Conexões Extras",
    "Coluna",
    "Linha",
    "Cor"
  ];

  const linhas = [cabecalho.join("\t")];

  const mapaUidParaId = {};
  fluxoData.forEach(l => {
    mapaUidParaId[l.uid] = l.id;
  });

  fluxoData.forEach(linha => {
    const proxSim = mapaUidParaId[linha.proxSim] || "";
    const proxNao = mapaUidParaId[linha.proxNao] || "";

    const extras = (linha.extras || [])
      .map(uid => mapaUidParaId[uid] || "")
      .filter(Boolean)
      .join(",");

    const row = [
      linha.ordem || "",
      linha.id || "",
      linha.area || "",
      linha.atividade || "",
      linha.tipo || "",
      linha.sistema || "",
      linha.tempo || "",
      proxSim,
      proxNao,
      extras,
      linha.coluna || 1,
      linha.linha || 1,
      linha.cor || "white"
    ];

    linhas.push(row.join("\t"));
  });

  const conteudo = linhas.join("\n");
  const BOM = "\uFEFF";

  const blob = new Blob([BOM + conteudo], {
    type: "text/tab-separated-values;charset=utf-8;"
  });

  const link = document.createElement("a");
  const nomeArquivo = (ultimoNomeArquivo || "template_fluxo") + ".xls";

  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(link.href);
}

function limparTudo() {
  const temDadosTopo =
    obterValorCampo("desenho") ||
    obterValorCampo("processo") ||
    obterValorCampo("analista") ||
    obterValorCampo("negocio") ||
    obterValorCampo("area") ||
    obterValorCampo("gestor") ||
    obterValorCampo("entrada");

  const temEtapas = Array.isArray(fluxoData) && fluxoData.some(linha =>
    limpar(linha.area || "") ||
    limpar(linha.atividade || "") ||
    limpar(linha.tipo || "") ||
    limpar(linha.sistema || "") ||
    limpar(linha.tempo || "") ||
    Number(linha.coluna || 1) !== 1 ||
    Number(linha.linha || 1) !== 1 ||
    limpar(linha.proxSim || "") ||
    limpar(linha.proxNao || "") ||
    (Array.isArray(linha.extras) && linha.extras.some(x => limpar(x || ""))) ||
    (linha.cor && linha.cor !== "white")
  );

  const temDiagrama = !!document.querySelector("#diagram svg");

  if (temDadosTopo || temEtapas || temDiagrama) {
    const confirmar = confirm("Deseja realmente excluir todo o fluxo e limpar todos os campos?");
    if (!confirmar) return;
  }

  fecharAutocomplete();

  limparCampo("desenho");
  limparCampo("processo");
  limparCampo("analista");
  limparCampo("negocio");
  limparCampo("area");
  limparCampo("gestor");
  limparCampo("entrada");

  fluxoData = [];
  uidCounter = 1;
  ultimoNomeArquivo = "fluxograma_processo";

  const diagram = document.getElementById("diagram");
  const infoProcesso = document.getElementById("infoProcesso");
  const metricas = document.getElementById("metricas");

  if (diagram) diagram.innerHTML = "";
  if (infoProcesso) infoProcesso.innerHTML = "";
  if (metricas) metricas.innerHTML = "";

  limparEstadoLocal();

  // recria estado visual limpo
  adicionarLinha(0);

  // garante atualização visual completa
  atualizarTabela();
  renderizarDatalists();
  atualizarOpcoesDeConexao();
  salvarEstadoLocal(true);
}

function adicionarLoopSeNecessario(origemId, destinoId, etapaPorId, etapaAtual) {
  const destino = etapaPorId[destinoId];
  if (destino && destino.ordem < etapaAtual.ordem) {
    return 1;
  }
  return 0;
}

function adicionarEtapasImpactadasPorRetorno(origemId, destinoId, etapaPorId, etapasOrdenadas, etapasImpactadasRef) {
  const origem = etapaPorId[origemId];
  const destino = etapaPorId[destinoId];

  if (!origem || !destino) return;
  if (destino.ordem >= origem.ordem) return;

  etapasOrdenadas.forEach((etapa) => {
    if (etapa.ordem >= destino.ordem && etapa.ordem <= origem.ordem) {
      etapasImpactadasRef.add(etapa.id);
    }
  });
}

function desenharCapsula(svg, texto, x, y, width = 60, height = 36) {
  const g = criarElementoSVG("g");

  const rect = criarElementoSVG("rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", height / 2);
  rect.setAttribute("ry", height / 2);
  rect.setAttribute("fill", "#ffffff");
  rect.setAttribute("stroke", CONFIG.stroke);
  rect.setAttribute("stroke-width", "2");
  g.appendChild(rect);

  const t = criarElementoSVG("text");
  t.setAttribute("x", x + width / 2);
  t.setAttribute("y", y + height / 2 + 5);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("font-family", CONFIG.fontFamily);
  t.setAttribute("font-size", "14");
  t.setAttribute("fill", "#111111");
  t.textContent = texto;
  g.appendChild(t);

  svg.appendChild(g);
}

function desenharNo(svg, etapa, pos) {
  const g = criarElementoSVG("g");
  const pergunta = ehDecisao(etapa);

  if (pergunta) {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;

    const polygon = criarElementoSVG("polygon");
    polygon.setAttribute(
      "points",
      `${cx},${pos.y} ${pos.x + pos.w},${cy} ${cx},${pos.y + pos.h} ${pos.x},${cy}`
    );
    polygon.setAttribute("class", `box ${etapa.cor}`);
    g.appendChild(polygon);
  } else {
    const rect = criarElementoSVG("rect");
    rect.setAttribute("x", pos.x);
    rect.setAttribute("y", pos.y);
    rect.setAttribute("width", pos.w);
    rect.setAttribute("height", pos.h);
    rect.setAttribute("class", `box ${etapa.cor}`);
    g.appendChild(rect);
  }

  const linhas = obterLinhasEtapa(etapa, pos.w);
  const alturaSistema = 24;
  const areaUtil = pos.h - alturaSistema;

  const totalAlturaTexto = linhas.length * CONFIG.textLineHeight;
  const inicioYTexto = pos.y + (areaUtil - totalAlturaTexto) / 2 + 14;

  linhas.forEach((linha, i) => {
    const text = criarElementoSVG("text");
    text.setAttribute("x", pos.x + pos.w / 2);
    text.setAttribute("y", inicioYTexto + i * CONFIG.textLineHeight);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-family", CONFIG.fontFamily);
    text.setAttribute("font-size", i === linhas.length - 1 ? CONFIG.smallFontSize : CONFIG.fontSize);
    text.setAttribute("fill", "#111111");
    text.textContent = linha;
    g.appendChild(text);
  });

  svg.appendChild(g);

  if (!pergunta) {
    desenharSistemaSeparado(svg, etapa, pos);
  }
}

function desenharRaias(svg, areasOrdenadas, lanes, svgWidth) {
  areasOrdenadas.forEach((area) => {
    const lane = lanes[area];
    if (!lane) return;

    const g = criarElementoSVG("g");

    const rectExterno = criarElementoSVG("rect");
    rectExterno.setAttribute("x", lane.x);
    rectExterno.setAttribute("y", lane.y);
    rectExterno.setAttribute("width", lane.width);
    rectExterno.setAttribute("height", lane.height);
    rectExterno.setAttribute("fill", "#ffffff");
    rectExterno.setAttribute("stroke", CONFIG.laneBorder);
    rectExterno.setAttribute("stroke-width", "1.2");
    g.appendChild(rectExterno);

    const header = criarElementoSVG("rect");
    header.setAttribute("x", lane.x);
    header.setAttribute("y", lane.y);
    header.setAttribute("width", CONFIG.laneLabelWidth);
    header.setAttribute("height", lane.height);
    header.setAttribute("fill", CONFIG.laneHeaderFill);
    header.setAttribute("stroke", CONFIG.laneBorder);
    header.setAttribute("stroke-width", "1");
    g.appendChild(header);

    const separator = criarElementoSVG("line");
    separator.setAttribute("x1", lane.x + CONFIG.laneLabelWidth);
    separator.setAttribute("y1", lane.y);
    separator.setAttribute("x2", lane.x + CONFIG.laneLabelWidth);
    separator.setAttribute("y2", lane.y + lane.height);
    separator.setAttribute("stroke", CONFIG.laneSeparator);
    separator.setAttribute("stroke-width", "1");
    g.appendChild(separator);

    const texto = criarElementoSVG("text");
    const tx = lane.x + CONFIG.laneLabelWidth / 2;
    const ty = lane.y + lane.height / 2;
    texto.setAttribute("x", tx);
    texto.setAttribute("y", ty);
    texto.setAttribute("text-anchor", "middle");
    texto.setAttribute("font-family", CONFIG.fontFamily);
    texto.setAttribute("font-size", String(CONFIG.laneHeaderFontSize));
    texto.setAttribute("font-weight", "bold");
    texto.setAttribute("fill", "#333333");
    texto.setAttribute("transform", `rotate(-90 ${tx} ${ty})`);
    texto.textContent = area;
    g.appendChild(texto);

    svg.appendChild(g);
  });
}

function desenharRaiasExcel(svg, lanes) {
  const strokeColor = "#bdbdbd";
  const strokeWidth = 1.2;
  const lineHeight = CONFIG.laneHeaderFontSize + 4;

  lanes.forEach((lane, index) => {
    const prevLane = lanes[index - 1] || null;
    const nextLane = lanes[index + 1] || null;

    const topLineY = prevLane
      ? prevLane.y + prevLane.height + (EXCEL_LAYOUT.laneGap / 2)
      : lane.y;

    const bottomLineY = nextLane
      ? lane.y + lane.height + (EXCEL_LAYOUT.laneGap / 2)
      : lane.y + lane.height;

    const visualHeight = bottomLineY - topLineY;

    const labelCenterX = lane.x + lane.labelWidth / 2;
    const labelCenterY = topLineY + visualHeight / 2;

    // linha horizontal superior
    const linhaTopo = criarElementoSVG("line");
    linhaTopo.setAttribute("x1", lane.x);
    linhaTopo.setAttribute("y1", topLineY);
    linhaTopo.setAttribute("x2", lane.x + lane.width);
    linhaTopo.setAttribute("y2", topLineY);
    linhaTopo.setAttribute("stroke", strokeColor);
    linhaTopo.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(linhaTopo);

    // linha horizontal inferior
    const linhaBase = criarElementoSVG("line");
    linhaBase.setAttribute("x1", lane.x);
    linhaBase.setAttribute("y1", bottomLineY);
    linhaBase.setAttribute("x2", lane.x + lane.width);
    linhaBase.setAttribute("y2", bottomLineY);
    linhaBase.setAttribute("stroke", strokeColor);
    linhaBase.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(linhaBase);

    // separador vertical do nome da raia
    const separador = criarElementoSVG("line");
    separador.setAttribute("x1", lane.x + lane.labelWidth);
    separador.setAttribute("y1", topLineY);
    separador.setAttribute("x2", lane.x + lane.labelWidth);
    separador.setAttribute("y2", bottomLineY);
    separador.setAttribute("stroke", strokeColor);
    separador.setAttribute("stroke-width", strokeWidth);
    svg.appendChild(separador);

    const linhas = lane.labelLines && lane.labelLines.length
      ? lane.labelLines
      : [lane.area];

    const totalAlturaTexto = (linhas.length - 1) * lineHeight;

    linhas.forEach((linha, i) => {
      const texto = criarElementoSVG("text");
      texto.setAttribute("x", labelCenterX);
      texto.setAttribute("y", labelCenterY - totalAlturaTexto / 2 + i * lineHeight);
      texto.setAttribute("text-anchor", "middle");
      texto.setAttribute("dominant-baseline", "middle");
      texto.setAttribute("font-family", CONFIG.fontFamily);
      texto.setAttribute("font-size", String(CONFIG.laneHeaderFontSize));
      texto.setAttribute("font-weight", "bold");
      texto.setAttribute("fill", "#111111");
      texto.setAttribute("transform", `rotate(-90 ${labelCenterX} ${labelCenterY})`);
      texto.textContent = linha;
      svg.appendChild(texto);
    });
  });
}

function getAnchorPoint(node, side) {
  switch (side) {
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
    case "left":
      return { x: node.x, y: node.y + node.h / 2 };
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
    default:
      return { x: node.x + node.w, y: node.y + node.h / 2 };
  }
}

function createPolylinePath(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function normalizarPontos(points) {
  const resultado = [];

  points.forEach((point) => {
    if (!point) return;

    const p = {
      x: Number(point.x.toFixed(1)),
      y: Number(point.y.toFixed(1))
    };

    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.x === p.x && ultimo.y === p.y) return;
    resultado.push(p);
  });

  if (resultado.length <= 2) return resultado;

  const simplificado = [resultado[0]];

  for (let i = 1; i < resultado.length - 1; i++) {
    const anterior = simplificado[simplificado.length - 1];
    const atual = resultado[i];
    const proximo = resultado[i + 1];

    const mesmoX = anterior.x === atual.x && atual.x === proximo.x;
    const mesmoY = anterior.y === atual.y && atual.y === proximo.y;

    if (!mesmoX && !mesmoY) simplificado.push(atual);
  }

  simplificado.push(resultado[resultado.length - 1]);
  return simplificado;
}

function segmentoInterceptaAreaExpandida(p1, p2, left, top, right, bottom) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const horizontal = p1.y === p2.y;
  const vertical = p1.x === p2.x;

  if (horizontal) {
    return p1.y >= top && p1.y <= bottom && maxX >= left && minX <= right;
  }

  if (vertical) {
    return p1.x >= left && p1.x <= right && maxY >= top && minY <= bottom;
  }

  return false;
}

function pathCruzaCaixas(points, posicoes = {}, excludeIds = []) {
  const nodes = Object.values(posicoes).filter(node => !excludeIds.includes(node.id));

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const node of nodes) {
      const padX = CONFIG.obstaclePadding;
      const padY = CONFIG.obstaclePadding;
      const left = node.x - padX;
      const right = node.x + node.w + padX;
      const top = node.y - padY;
      const bottom = node.y + node.h + padY;

      if (segmentoInterceptaAreaExpandida(p1, p2, left, top, right, bottom)) {
        return true;
      }
    }
  }

  return false;
}

function segmentosDoPath(points) {
  const segmentos = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (!p1 || !p2) continue;
    if (p1.x === p2.x && p1.y === p2.y) continue;

    segmentos.push({ p1, p2 });
  }

  return segmentos;
}

function intervaloSeSobrepoe(a1, a2, b1, b2, margem = 0) {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);

  return Math.max(minA, minB) <= Math.min(maxA, maxB) + margem;
}

function segmentosOrtogonaisSeCruzam(segA, segB, margem = 2) {
  const aVertical = segA.p1.x === segA.p2.x;
  const aHorizontal = segA.p1.y === segA.p2.y;
  const bVertical = segB.p1.x === segB.p2.x;
  const bHorizontal = segB.p1.y === segB.p2.y;

  if (!(aVertical || aHorizontal) || !(bVertical || bHorizontal)) {
    return false;
  }

  // vertical x horizontal
  if (aVertical && bHorizontal) {
    const x = segA.p1.x;
    const y = segB.p1.y;

    return (
      intervaloSeSobrepoe(segA.p1.y, segA.p2.y, y, y, margem) &&
      intervaloSeSobrepoe(segB.p1.x, segB.p2.x, x, x, margem)
    );
  }

  // horizontal x vertical
  if (aHorizontal && bVertical) {
    const x = segB.p1.x;
    const y = segA.p1.y;

    return (
      intervaloSeSobrepoe(segA.p1.x, segA.p2.x, x, x, margem) &&
      intervaloSeSobrepoe(segB.p1.y, segB.p2.y, y, y, margem)
    );
  }

  // paralelos sobrepostos
  if (aVertical && bVertical && Math.abs(segA.p1.x - segB.p1.x) <= margem) {
    return intervaloSeSobrepoe(segA.p1.y, segA.p2.y, segB.p1.y, segB.p2.y, margem);
  }

  if (aHorizontal && bHorizontal && Math.abs(segA.p1.y - segB.p1.y) <= margem) {
    return intervaloSeSobrepoe(segA.p1.x, segA.p2.x, segB.p1.x, segB.p2.x, margem);
  }

  return false;
}

function pathCruzaConexoes(points, rotasExistentes = [], tolerancia = 2) {
  if (!rotasExistentes || !rotasExistentes.length) return false;

  const segmentosNovos = segmentosDoPath(points);

  for (const rotaExistente of rotasExistentes) {
    const segmentosExistentes = segmentosDoPath(rotaExistente.points || []);

    for (const segNovo of segmentosNovos) {
      for (const segExistente of segmentosExistentes) {
        // permite tocar na ponta exata
        const compartilhaPonta =
          (segNovo.p1.x === segExistente.p1.x && segNovo.p1.y === segExistente.p1.y) ||
          (segNovo.p1.x === segExistente.p2.x && segNovo.p1.y === segExistente.p2.y) ||
          (segNovo.p2.x === segExistente.p1.x && segNovo.p2.y === segExistente.p1.y) ||
          (segNovo.p2.x === segExistente.p2.x && segNovo.p2.y === segExistente.p2.y);

        if (compartilhaPonta) continue;

        if (segmentosOrtogonaisSeCruzam(segNovo, segExistente, tolerancia)) {
          return true;
        }
      }
    }
  }

  return false;
}

function obterLadosUsadosDoNo(noId, rotasExistentes = []) {
  const usados = new Set();

  (rotasExistentes || []).forEach((rota) => {
    if (!rota || !rota.points || rota.points.length < 2) return;

    if (rota.origemId === noId) {
      usados.add(detectarLadoSaida(rota.points));
    }

    if (rota.destinoId === noId) {
      usados.add(detectarLadoEntrada(rota.points));
    }
  });

  return usados;
}

function obterUsoDetalhadoLadosDoNo(noId, rotasExistentes = []) {
  const uso = {
    origem: { left: 0, right: 0, top: 0, bottom: 0 },
    destino: { left: 0, right: 0, top: 0, bottom: 0 }
  };

  (rotasExistentes || []).forEach((rota) => {
    if (!rota || !rota.points || rota.points.length < 2) return;

    if (rota.origemId === noId) {
      const ladoSaida = detectarLadoSaida(rota.points);
      if (uso.origem[ladoSaida] !== undefined) {
        uso.origem[ladoSaida]++;
      }
    }

    if (rota.destinoId === noId) {
      const ladoEntrada = detectarLadoEntrada(rota.points);
      if (uso.destino[ladoEntrada] !== undefined) {
        uso.destino[ladoEntrada]++;
      }
    }
  });

  return uso;
}

function obterLimitesRaiaDaArea(area, posicoes = {}) {
  const nosArea = Object.values(posicoes).filter(
    n => n && n.area === area && n.id !== "__INICIO__" && n.id !== "__FIM__"
  );

  if (!nosArea.length) {
    return { top: 0, bottom: 999999 };
  }

  const top = Math.min(...nosArea.map(n => n.laneTop ?? n.y));
  const bottom = Math.max(...nosArea.map(n => n.laneBottom ?? (n.y + n.h)));

  return { top, bottom };
}

function calcularCanalSuperiorDentroRaia(origem, destino, nivelCanal = 1, posicoes = {}) {
  const limites = obterLimitesRaiaDaArea(origem.area, posicoes);

  const topoNos = Math.min(origem.y, destino.y);
  const topoRaia = limites.top + 8;
  const baseLivre = topoNos - 10;

  // espaço livre acima dos nós
  const espacoDisponivel = Math.max(12, baseLivre - topoRaia);

  // divide o espaço livre em faixas para Sim / Não / extras
  const totalFaixas = 4;
  const passo = espacoDisponivel / totalFaixas;

  let canalY = baseLivre - passo * nivelCanal;

  if (canalY < topoRaia) canalY = topoRaia;
  if (canalY > baseLivre) canalY = baseLivre;

  return canalY;
}

function calcularCanalInferiorDentroRaia(origem, destino, nivelCanal = 1, posicoes = {}) {
  const limites = obterLimitesRaiaDaArea(origem.area, posicoes);

  const baseNos = Math.max(origem.y + origem.h, destino.y + destino.h);
  const topoLivre = baseNos + 10;
  const fundoRaia = limites.bottom - 8;

  // se não existir espaço real abaixo, encosta no limite mais baixo possível
  if (topoLivre >= fundoRaia) {
    return topoLivre;
  }

  const espacoDisponivel = fundoRaia - topoLivre;
  const totalFaixas = 4;
  const passo = espacoDisponivel / totalFaixas;

  let canalY = topoLivre + passo * nivelCanal;

  if (canalY < topoLivre) canalY = topoLivre;
  if (canalY > fundoRaia) canalY = fundoRaia;

  return canalY;
}

function rotaUsaMesmoLadoConflitante(origem, destino, startSide, endSide) {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  // mantém apenas a proteção do retorno horizontal para esquerda
  // evitando entrada pelo lado direito quando queremos preservar top/bottom
  if (
    origem.isDecision &&
    dy === 0 &&
    dx < 0 &&
    endSide === "right"
  ) {
    return true;
  }

  return false;
}

function calcularComprimento(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
  }
  return total;
}

function detectarLadoEntrada(points) {
  if (!points || points.length < 2) return "left";
  const prev = points[points.length - 2];
  const end = points[points.length - 1];

  if (prev.x < end.x) return "left";
  if (prev.x > end.x) return "right";
  if (prev.y < end.y) return "top";
  return "bottom";
}

function detectarLadoSaida(points) {
  if (!points || points.length < 2) return "right";
  const start = points[0];
  const next = points[1];

  if (next.x > start.x) return "right";
  if (next.x < start.x) return "left";
  if (next.y > start.y) return "bottom";
  return "top";
}

function ajustarUltimoTrechoParaLado(points, end, side, destinoNode = null) {
  if (!points || points.length < 2) return points;

  const resultado = [...points];
  const prev = resultado[resultado.length - 2];
  const destino = { x: end.x, y: end.y };

  if (side === "left" && Math.abs(prev.y - end.y) <= CONFIG.sameRowTolerance && prev.x <= (destinoNode ? destinoNode.x : end.x)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "right" && Math.abs(prev.y - end.y) <= CONFIG.sameRowTolerance && prev.x >= (destinoNode ? destinoNode.x + destinoNode.w : end.x)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "top" && Math.abs(prev.x - end.x) <= CONFIG.sameColTolerance && prev.y <= (destinoNode ? destinoNode.y : end.y)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  if (side === "bottom" && Math.abs(prev.x - end.x) <= CONFIG.sameColTolerance && prev.y >= (destinoNode ? destinoNode.y + destinoNode.h : end.y)) {
    resultado[resultado.length - 1] = destino;
    return normalizarPontos(resultado);
  }

  let pivot = null;

  if (side === "left") {
    pivot = { x: end.x - CONFIG.routeGap, y: end.y };
  } else if (side === "right") {
    pivot = { x: end.x + CONFIG.routeGap, y: end.y };
  } else if (side === "top") {
    pivot = { x: end.x, y: end.y - CONFIG.routeGap };
  } else if (side === "bottom") {
    pivot = { x: end.x, y: end.y + CONFIG.routeGap };
  }

  if (!pivot) return normalizarPontos(resultado);

  const novo = [...resultado.slice(0, -1)];
  const ultimoAntes = novo[novo.length - 1];

  if (ultimoAntes.x !== pivot.x && ultimoAntes.y !== pivot.y) {
    if (side === "left" || side === "right") {
      novo.push({ x: pivot.x, y: ultimoAntes.y });
    } else {
      novo.push({ x: ultimoAntes.x, y: pivot.y });
    }
  }

  novo.push(pivot);
  novo.push(destino);
  return normalizarPontos(novo);
}

function ajustarPrimeiroTrechoParaLado(points, start, side) {
  if (!points || points.length < 2) return points;

  const resultado = [...points];
  const next = resultado[1];

  if (side === "right" && Math.abs(next.y - start.y) <= CONFIG.sameRowTolerance && next.x > start.x) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "left" && Math.abs(next.y - start.y) <= CONFIG.sameRowTolerance && next.x < start.x) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "top" && Math.abs(next.x - start.x) <= CONFIG.sameColTolerance && next.y < start.y) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  if (side === "bottom" && Math.abs(next.x - start.x) <= CONFIG.sameColTolerance && next.y > start.y) {
    resultado[0] = { x: start.x, y: start.y };
    return normalizarPontos(resultado);
  }

  let escape = null;

  if (side === "right") escape = { x: start.x + CONFIG.routeGap, y: start.y };
  else if (side === "left") escape = { x: start.x - CONFIG.routeGap, y: start.y };
  else if (side === "top") escape = { x: start.x, y: start.y - CONFIG.routeGap };
  else if (side === "bottom") escape = { x: start.x, y: start.y + CONFIG.routeGap };

  if (!escape) return normalizarPontos(resultado);

  const novo = [{ x: start.x, y: start.y }, escape];

  if (resultado.length > 1) {
    const terceiro = resultado[1];

    if (side === "left" || side === "right") {
      if (escape.y !== terceiro.y && escape.x !== terceiro.x) {
        novo.push({ x: escape.x, y: terceiro.y });
      }
    } else {
      if (escape.x !== terceiro.x && escape.y !== terceiro.y) {
        novo.push({ x: terceiro.x, y: escape.y });
      }
    }

    for (let i = 1; i < resultado.length; i++) {
      novo.push(resultado[i]);
    }
  }

  return normalizarPontos(novo);
}

function gerarCandidatosRotas(start, end) {
  const candidates = [];

  const mids = [
    [{ x: end.x, y: start.y }],
    [{ x: start.x, y: end.y }],
    [
      { x: start.x + CONFIG.routeGap, y: start.y },
      { x: start.x + CONFIG.routeGap, y: end.y }
    ],
    [
      { x: start.x - CONFIG.routeGap, y: start.y },
      { x: start.x - CONFIG.routeGap, y: end.y }
    ],
    [
      { x: start.x, y: start.y + CONFIG.routeGap },
      { x: end.x, y: start.y + CONFIG.routeGap }
    ],
    [
      { x: start.x, y: start.y - CONFIG.routeGap },
      { x: end.x, y: start.y - CONFIG.routeGap }
    ]
  ];

  mids.forEach(midPoints => {
    candidates.push(normalizarPontos([start, ...midPoints, end]));
  });

  return candidates;
}

function encontrarRotaSegura(start, end, posicoes = {}, excludeIds = [], preferredEndSide = null, preferredStartSide = null, destinoNode = null) {
  const candidates = gerarCandidatosRotas(start, end);

  const avaliadas = candidates.map(points => {
    let ajustado = [...points];

    const startSide = preferredStartSide || detectarLadoSaida(ajustado);
    const endSide = preferredEndSide || detectarLadoEntrada(ajustado);

    ajustado = ajustarPrimeiroTrechoParaLado(ajustado, start, startSide);
    ajustado = ajustarUltimoTrechoParaLado(ajustado, end, endSide, destinoNode);

    return {
      points: ajustado,
      startSide,
      endSide,
      safe: !pathCruzaCaixas(ajustado, posicoes, excludeIds)
    };
  });

  const validos = avaliadas.filter(r => r.safe);

  if (validos.length) {
    validos.sort((a, b) => {
      if (a.points.length !== b.points.length) return a.points.length - b.points.length;
      return calcularComprimento(a.points) - calcularComprimento(b.points);
    });

    const melhor = validos[0];
    let ajustado = melhor.points;
    ajustado = ajustarPrimeiroTrechoParaLado(ajustado, start, preferredStartSide || melhor.startSide);
    ajustado = ajustarUltimoTrechoParaLado(ajustado, end, preferredEndSide || melhor.endSide, destinoNode);

    return {
      points: ajustado,
      startSide: preferredStartSide || melhor.startSide,
      endSide: preferredEndSide || melhor.endSide,
      safe: !pathCruzaCaixas(ajustado, posicoes, excludeIds)
    };
  }

  let fallback = normalizarPontos([start, { x: end.x, y: start.y }, end]);
  const startSide = preferredStartSide || detectarLadoSaida(fallback);
  const endSide = preferredEndSide || detectarLadoEntrada(fallback);

  fallback = ajustarPrimeiroTrechoParaLado(fallback, start, startSide);
  fallback = ajustarUltimoTrechoParaLado(fallback, end, endSide, destinoNode);

  return {
    points: fallback,
    startSide,
    endSide,
    safe: !pathCruzaCaixas(fallback, posicoes, excludeIds)
  };
}

function buildOrthogonalToMerge(start, mergePoint, end, endSide, posicoes = {}, excludeIds = [], preferredStartSide = null) {
  const ateMergeObj = encontrarRotaSegura(start, mergePoint, posicoes, excludeIds, null, preferredStartSide, null);
  return normalizarPontos([...ateMergeObj.points, end]);
}

function escolherParesCandidatos(origem, destino, rotulo = "") {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  if (origem.isDecision) {
    // decisão -> mesma linha à direita
    if (dy === 0 && dx > 0) {
      if (rotulo === "Sim") {
        return [
          { startSide: "right", endSide: "left" }, // prioridade: reto
          { startSide: "right", endSide: "top" },
          { startSide: "top", endSide: "top" }
        ];
      }

      if (rotulo === "Não") {
        return [
          { startSide: "top", endSide: "top" },
          { startSide: "right", endSide: "top" }
        ];
      }
    }

    // decisão -> mesma linha à esquerda
    if (dy === 0 && dx < 0) {
      if (rotulo === "Não") {
        return [
          { startSide: "bottom", endSide: "bottom" },
          { startSide: "top", endSide: "top" },
          { startSide: "right", endSide: "bottom" }
        ];
      }

      if (rotulo === "Sim") {
        return [
          { startSide: "top", endSide: "top" },
          { startSide: "bottom", endSide: "bottom" },
          { startSide: "left", endSide: "right" }
        ];
      }
    }

    // decisão -> acima e à esquerda
    if (dx < 0 && dy < 0 && rotulo === "Não") {
      return [
        { startSide: "bottom", endSide: "bottom" },
        { startSide: "top", endSide: "top" },
        { startSide: "right", endSide: "bottom" },
        { startSide: "left", endSide: "bottom" }
      ];
    }

    // decisão -> abaixo
    if (dx === 0 && dy > 0) {
      return [
        { startSide: "bottom", endSide: "top" },
        { startSide: "right", endSide: "top" },
        { startSide: "left", endSide: "top" }
      ];
    }

    // decisão -> acima
    if (dx === 0 && dy < 0) {
      return [
        { startSide: "top", endSide: "bottom" },
        { startSide: "right", endSide: "bottom" },
        { startSide: "left", endSide: "bottom" }
      ];
    }
  }

  if (dx === 0 && dy > 0) {
    return [{ startSide: "bottom", endSide: "top" }];
  }

  if (dx === 0 && dy < 0) {
    return [{ startSide: "top", endSide: "bottom" }];
  }

  if (dy === 0 && dx > 0) {
    return [{ startSide: "right", endSide: "left" }];
  }

  if (dy === 0 && dx < 0) {
    return [{ startSide: "left", endSide: "right" }];
  }

  if (dx > 0 && dy > 0) {
    return [
      { startSide: "right", endSide: "left" },
      { startSide: "right", endSide: "top" },
      { startSide: "bottom", endSide: "left" },
      { startSide: "bottom", endSide: "top" }
    ];
  }

  if (dx > 0 && dy < 0) {
    return [
      { startSide: "right", endSide: "left" },
      { startSide: "right", endSide: "bottom" },
      { startSide: "top", endSide: "left" },
      { startSide: "top", endSide: "bottom" }
    ];
  }

  if (dx < 0 && dy > 0) {
    return [
      { startSide: "left", endSide: "right" },
      { startSide: "left", endSide: "top" },
      { startSide: "bottom", endSide: "right" },
      { startSide: "bottom", endSide: "top" }
    ];
  }

  if (dx < 0 && dy < 0) {
    return [
      { startSide: "left", endSide: "right" },
      { startSide: "left", endSide: "bottom" },
      { startSide: "top", endSide: "right" },
      { startSide: "top", endSide: "bottom" }
    ];
  }

  return [{ startSide: "right", endSide: "left" }];
}

function montarRotaOrtogonal(points, label, startSide = "", endSide = "") {
  return {
    points: normalizarPontos(points),
    label,
    startSide,
    endSide
  };
}

function getMergePoint(end, side, gap = CONFIG.sharedMergeGap) {
  switch (side) {
    case "left": return { x: end.x - gap, y: end.y };
    case "right": return { x: end.x + gap, y: end.y };
    case "top": return { x: end.x, y: end.y - gap };
    case "bottom": return { x: end.x, y: end.y + gap };
    default: return { x: end.x - gap, y: end.y };
  }
}

function tentarRotaDecisaoMesmaLinhaAcima(
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  rotasExistentes = []
) {
  if (!origem.isDecision) {
    return null;
  }

  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  const rotuloNormalizado = String(rotulo || "").toLowerCase();
  const ehSim = rotuloNormalizado.startsWith("sim");
  const ehNao = rotuloNormalizado.startsWith("não") || rotuloNormalizado.startsWith("nao");

  const mesmoNivel = dy === 0;
  const vaiParaDireita = dx > 0;
  const vaiParaEsquerda = dx < 0;
  const sobe = dy < 0;

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];
  const ladosUsadosOrigem = obterLadosUsadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoOrigem = obterUsoDetalhadoLadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoDestino = obterUsoDetalhadoLadosDoNo(destino.id, rotasExistentes);

  const candidatos = [];

  function penalidadeLado(startSide, endSide) {
    let score = 0;

    const usoOrigem = usoDetalhadoOrigem.origem[startSide] || 0;
    const usoDestino = usoDetalhadoDestino.destino[endSide] || 0;

    if (ladosUsadosOrigem.has(startSide)) score += 1000;
    if (usoOrigem > 0) score += usoOrigem * 1000;
    if (usoDestino > 0) score += usoDestino * 900;

    if (ehSim && vaiParaDireita && mesmoNivel) {
      if (startSide !== "right") score += 300;
      if (endSide !== "left") score += 220;
    }

    if (ehNao && vaiParaEsquerda && mesmoNivel) {
      const simJaSaiuPelaDireita = ladosUsadosOrigem.has("right");

      if (simJaSaiuPelaDireita) {
        if (startSide !== "top") score += 260;
        if (endSide !== "top") score += 160;
      } else {
        if (startSide !== "bottom") score += 260;
        if (endSide !== "bottom") score += 160;
      }
    }

    if (ehNao && vaiParaEsquerda && sobe) {
      if (startSide !== "bottom") score += 220;
      if (endSide !== "bottom") score += 140;
    }

    return score;
  }

  function registrarCandidato(startSide, endSide, pontosBase, labelPoint = null) {
    const rota = normalizarPontos(pontosBase);
    const cruzaCaixa = pathCruzaCaixas(rota, posicoes, excludeIds);

    const rotasComparacao = (rotasExistentes || []).filter(r =>
      !(r.origemId === origem.id && r.destinoId === destino.id)
    );

    const cruzaLinha = pathCruzaConexoes(rota, rotasComparacao);
    const comprimento = calcularComprimento(rota);

    const reusaSaidaOrigem = (usoDetalhadoOrigem.origem[startSide] || 0) > 0;
    const reusaEntradaDestino = (usoDetalhadoDestino.destino[endSide] || 0) > 0;

    candidatos.push({
      points: rota,
      startSide,
      endSide,
      cruzaCaixa,
      cruzaLinha,
      comprimento,
      reusaSaidaOrigem,
      reusaEntradaDestino,
      pesoLado: penalidadeLado(startSide, endSide),
      label: labelPoint || {
        x: rota[Math.floor(rota.length / 2)].x,
        y: rota[Math.floor(rota.length / 2)].y - 10
      }
    });
  }

  function registrarCandidatoCanal(startSide, endSide, canalY) {
    const start = getAnchorPoint(origem, startSide);
    const end = getAnchorPoint(destino, endSide);

    const points = [{ x: start.x, y: start.y }];

    if (startSide === "right") {
      const escapeX = start.x + CONFIG.routeGap;
      points.push({ x: escapeX, y: start.y });
      points.push({ x: escapeX, y: canalY });
    } else if (startSide === "left") {
      const escapeX = start.x - CONFIG.routeGap;
      points.push({ x: escapeX, y: start.y });
      points.push({ x: escapeX, y: canalY });
    } else {
      points.push({ x: start.x, y: canalY });
    }

    points.push({ x: end.x, y: canalY });
    points.push({ x: end.x, y: end.y });

    registrarCandidato(
      startSide,
      endSide,
      points,
      {
        x: (start.x + end.x) / 2,
        y: (startSide === "bottom" || endSide === "bottom") ? canalY + 14 : canalY - 10
      }
    );
  }

  if (mesmoNivel && vaiParaDireita) {
    const startRight = getAnchorPoint(origem, "right");
    const endLeft = getAnchorPoint(destino, "left");

    if (ehSim) {
      registrarCandidato(
        "right",
        "left",
        [
          { x: startRight.x, y: startRight.y },
          { x: endLeft.x, y: endLeft.y }
        ],
        {
          x: (startRight.x + endLeft.x) / 2,
          y: startRight.y - 10
        }
      );
    }

    for (let extra = 0; extra < 4; extra++) {
      if (ehSim) {
        registrarCandidatoCanal(
          "right",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      } else if (ehNao) {
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );
        registrarCandidatoCanal(
          "right",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      }
    }
  }

  if (mesmoNivel && vaiParaEsquerda && ehNao) {
    const simJaSaiuPelaDireita = ladosUsadosOrigem.has("right");

    for (let extra = 0; extra < 5; extra++) {
      if (simJaSaiuPelaDireita) {
        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );

        registrarCandidatoCanal(
          "bottom",
          "bottom",
          calcularCanalInferiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      } else {
        registrarCandidatoCanal(
          "bottom",
          "bottom",
          calcularCanalInferiorDentroRaia(origem, destino, 1 + ordemConexao + extra, posicoes)
        );

        registrarCandidatoCanal(
          "top",
          "top",
          calcularCanalSuperiorDentroRaia(origem, destino, 2 + ordemConexao + extra, posicoes)
        );
      }

      registrarCandidatoCanal(
        "right",
        "bottom",
        calcularCanalInferiorDentroRaia(origem, destino, 3 + ordemConexao + extra, posicoes)
      );
    }
  }

  if (ehNao && vaiParaEsquerda && sobe) {
    const startBottom = getAnchorPoint(origem, "bottom");
    const endBottom = getAnchorPoint(destino, "bottom");
    const startRight = getAnchorPoint(origem, "right");

    for (let extra = 0; extra < 6; extra++) {
      const canalY = calcularCanalInferiorDentroRaia(
        origem,
        destino,
        1 + ordemConexao + extra,
        posicoes
      );

      registrarCandidato(
        "bottom",
        "bottom",
        [
          { x: startBottom.x, y: startBottom.y },
          { x: startBottom.x, y: canalY },
          { x: endBottom.x, y: canalY },
          { x: endBottom.x, y: endBottom.y }
        ],
        {
          x: (startBottom.x + endBottom.x) / 2,
          y: canalY + 14
        }
      );

      const escapeX = startRight.x + CONFIG.routeGap;
      registrarCandidato(
        "right",
        "bottom",
        [
          { x: startRight.x, y: startRight.y },
          { x: escapeX, y: startRight.y },
          { x: escapeX, y: canalY },
          { x: endBottom.x, y: canalY },
          { x: endBottom.x, y: endBottom.y }
        ],
        {
          x: (escapeX + endBottom.x) / 2,
          y: canalY + 14
        }
      );
    }
  }

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;
    if (a.reusaSaidaOrigem !== b.reusaSaidaOrigem) return a.reusaSaidaOrigem ? 1 : -1;
    if (a.reusaEntradaDestino !== b.reusaEntradaDestino) return a.reusaEntradaDestino ? 1 : -1;
    if (a.pesoLado !== b.pesoLado) return a.pesoLado - b.pesoLado;
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemConflitoForte = candidatos.find(c =>
    !c.cruzaCaixa &&
    !c.cruzaLinha &&
    !c.reusaSaidaOrigem &&
    !c.reusaEntradaDestino
  );

  const melhorSemCruzar = candidatos.find(c =>
    !c.cruzaCaixa &&
    !c.cruzaLinha
  );

  const melhorSemCaixa = candidatos.find(c => !c.cruzaCaixa);
  const melhor = melhorSemConflitoForte || melhorSemCruzar || melhorSemCaixa || candidatos[0];

  if (melhor.cruzaCaixa) {
    return null;
  }

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function tentarRotaRetornoSuperior(
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  rotasExistentes = []
) {
  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  // foco: destino à esquerda e acima
  if (!(dx < 0 && dy < 0)) {
    return null;
  }

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];
  const candidatos = [];

  function registrar(points, startSide, endSide, canalY) {
    const rota = normalizarPontos(points);

    const rotasComparacao = (rotasExistentes || []).filter(r =>
      !(r.origemId === origem.id && r.destinoId === destino.id)
    );

    candidatos.push({
      points: rota,
      startSide,
      endSide,
      cruzaCaixa: pathCruzaCaixas(rota, posicoes, excludeIds),
      cruzaLinha: pathCruzaConexoes(rota, rotasComparacao),
      comprimento: calcularComprimento(rota),
      label: {
        x: (points[0].x + points[points.length - 1].x) / 2,
        y: canalY - 10
      }
    });
  }

  for (let extra = 0; extra < 6; extra++) {
    const canalY = calcularCanalSuperiorDentroRaia(
      origem,
      destino,
      1 + ordemConexao + extra,
      posicoes
    );

    const startTop = getAnchorPoint(origem, "top");
    const endTop = getAnchorPoint(destino, "top");
    const endBottom = getAnchorPoint(destino, "bottom");
    const startLeft = getAnchorPoint(origem, "left");

    // 1) preferido: sai por cima e entra por cima
    registrar(
      [
        { x: startTop.x, y: startTop.y },
        { x: startTop.x, y: canalY },
        { x: endTop.x, y: canalY },
        { x: endTop.x, y: endTop.y }
      ],
      "top",
      "top",
      canalY
    );

    // 2) alternativa: sai por cima e entra por baixo
    registrar(
      [
        { x: startTop.x, y: startTop.y },
        { x: startTop.x, y: canalY },
        { x: endBottom.x, y: canalY },
        { x: endBottom.x, y: endBottom.y }
      ],
      "top",
      "bottom",
      canalY
    );

    // 3) alternativa: sai pela esquerda, sobe e entra por cima
    const escapeX = startLeft.x - CONFIG.routeGap;
    registrar(
      [
        { x: startLeft.x, y: startLeft.y },
        { x: escapeX, y: startLeft.y },
        { x: escapeX, y: canalY },
        { x: endTop.x, y: canalY },
        { x: endTop.x, y: endTop.y }
      ],
      "left",
      "top",
      canalY
    );
  }

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;

    // prioridade explícita:
    // top->top > top->bottom > left->top
    const rank = (c) => {
      if (c.startSide === "top" && c.endSide === "top") return 1;
      if (c.startSide === "top" && c.endSide === "bottom") return 2;
      if (c.startSide === "left" && c.endSide === "top") return 3;
      return 9;
    };

    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemCruzar = candidatos.find(c => !c.cruzaCaixa && !c.cruzaLinha);
  const melhorSemCaixa = candidatos.find(c => !c.cruzaCaixa);
  const melhor = melhorSemCruzar || melhorSemCaixa || candidatos[0];

  if (melhor.cruzaCaixa) {
    return null;
  }

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function escolherRota(origem, destino, contexto = {}) {
  const rotulo = contexto.rotulo || "";
  const ordemConexao = contexto.ordemConexao || 0;
  const posicoes = contexto.posicoes || {};
  const rotasExistentes = contexto.rotasExistentes || [];
  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];

  // === Override manual do editor: força os lados escolhidos pelo usuário ===
  const override = obterOverrideConexao(origem.id, destino.id);
  if (override && override.startSide && override.endSide) {
    const start = getAnchorPoint(origem, override.startSide);
    const end = getAnchorPoint(destino, override.endSide);
    const rota = encontrarRotaSegura(
      start, end, posicoes, excludeIds,
      override.endSide, override.startSide, destino
    );
    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      override.startSide,
      override.endSide
    );
  }

  if (origem.id === "__INICIO__") {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  if (destino.id === "__FIM__") {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  const rotaEspecialDecisao = tentarRotaDecisaoMesmaLinhaAcima(
    origem,
    destino,
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes
  );

  if (rotaEspecialDecisao) {
    return rotaEspecialDecisao;
  }

  const rotaRetornoSuperior = tentarRotaRetornoSuperior(
    origem,
    destino,
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes
  );

  if (rotaRetornoSuperior) {
    return rotaRetornoSuperior;
  }

  const ladosUsadosOrigem = obterLadosUsadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoOrigem = obterUsoDetalhadoLadosDoNo(origem.id, rotasExistentes);
  const usoDetalhadoDestino = obterUsoDetalhadoLadosDoNo(destino.id, rotasExistentes);

  const dx = destino.gridCol - origem.gridCol;
  const dy = destino.gridRowGlobal - origem.gridRowGlobal;

  function penalidadeLadoFallback(startSide, endSide) {
    let score = 0;

    const usoOrigem = usoDetalhadoOrigem.origem[startSide] || 0;
    const usoDestino = usoDetalhadoDestino.destino[endSide] || 0;

    if (ladosUsadosOrigem.has(startSide)) score += 1000;
    if (usoOrigem > 0) score += usoOrigem * 1000;
    if (usoDestino > 0) score += usoDestino * 900;

    if (origem.isDecision && dy === 0 && dx < 0 && rotulo === "Não") {
      if (startSide !== "bottom") score += 250;
      if (endSide !== "bottom") score += 120;
    }

    if (origem.isDecision && dy < 0 && dx < 0 && rotulo === "Não") {
      if (startSide !== "bottom") score += 300;
      if (endSide !== "bottom") score += 180;
    }

    return score;
  }

  const pares = escolherParesCandidatos(origem, destino, rotulo);
  const tentativas = [];

  for (const par of pares) {
    if (rotaUsaMesmoLadoConflitante(origem, destino, par.startSide, par.endSide)) {
      continue;
    }

    const start = getAnchorPoint(origem, par.startSide);
    const end = getAnchorPoint(destino, par.endSide);

    const rota = encontrarRotaSegura(
      start,
      end,
      posicoes,
      excludeIds,
      par.endSide,
      par.startSide,
      destino
    );

    const pontosRota = rota.points || [];
    const cruzaCaixa = pathCruzaCaixas(pontosRota, posicoes, excludeIds);
    const cruzaLinha = pathCruzaConexoes(pontosRota, rotasExistentes);
    const comprimento = calcularComprimento(pontosRota);
    const pesoLado = penalidadeLadoFallback(par.startSide, par.endSide);

    const reusaSaidaOrigem = (usoDetalhadoOrigem.origem[par.startSide] || 0) > 0;
    const reusaEntradaDestino = (usoDetalhadoDestino.destino[par.endSide] || 0) > 0;

    let comprimentoTotal = 0;
    const segmentos = [];

    for (let i = 0; i < pontosRota.length - 1; i++) {
      const p1 = pontosRota[i];
      const p2 = pontosRota[i + 1];
      const comprimentoSeg = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);

      if (comprimentoSeg > 0) {
        segmentos.push({
          p1,
          p2,
          comprimento: comprimentoSeg,
          inicio: comprimentoTotal,
          fim: comprimentoTotal + comprimentoSeg
        });
        comprimentoTotal += comprimentoSeg;
      }
    }

    let labelPoint = { x: start.x + 18, y: start.y - 10 };

    if (segmentos.length > 0 && comprimentoTotal > 0) {
      const alvo = comprimentoTotal / 2;

      for (const segmento of segmentos) {
        if (alvo >= segmento.inicio && alvo <= segmento.fim) {
          const deslocamento = alvo - segmento.inicio;

          if (segmento.p1.y === segmento.p2.y) {
            const direcao = segmento.p2.x >= segmento.p1.x ? 1 : -1;
            labelPoint = {
              x: segmento.p1.x + deslocamento * direcao,
              y: segmento.p1.y
            };
          } else if (segmento.p1.x === segmento.p2.x) {
            const direcao = segmento.p2.y >= segmento.p1.y ? 1 : -1;
            labelPoint = {
              x: segmento.p1.x,
              y: segmento.p1.y + deslocamento * direcao
            };
          }

          break;
        }
      }
    }

    tentativas.push({
      ...rota,
      cruzaCaixa,
      cruzaLinha,
      comprimento,
      pesoLado,
      reusaSaidaOrigem,
      reusaEntradaDestino,
      label: labelPoint
    });
  }

  if (!tentativas.length) {
    const start = getAnchorPoint(origem, "right");
    const end = getAnchorPoint(destino, "left");
    const rota = encontrarRotaSegura(start, end, posicoes, excludeIds, "left", "right", destino);

    return montarRotaOrtogonal(
      rota.points,
      { x: (start.x + end.x) / 2, y: start.y - 10 },
      rota.startSide,
      rota.endSide
    );
  }

  tentativas.sort((a, b) => {
    if (a.cruzaCaixa !== b.cruzaCaixa) return a.cruzaCaixa ? 1 : -1;
    if (a.cruzaLinha !== b.cruzaLinha) return a.cruzaLinha ? 1 : -1;
    if (a.reusaSaidaOrigem !== b.reusaSaidaOrigem) return a.reusaSaidaOrigem ? 1 : -1;
    if (a.reusaEntradaDestino !== b.reusaEntradaDestino) return a.reusaEntradaDestino ? 1 : -1;
    if (a.pesoLado !== b.pesoLado) return a.pesoLado - b.pesoLado;
    if (a.points.length !== b.points.length) return a.points.length - b.points.length;
    return a.comprimento - b.comprimento;
  });

  const melhorSemConflitoForte = tentativas.find(t =>
    !t.cruzaCaixa &&
    !t.cruzaLinha &&
    !t.reusaSaidaOrigem &&
    !t.reusaEntradaDestino
  );

  const melhorSemCruzar = tentativas.find(t =>
    !t.cruzaCaixa &&
    !t.cruzaLinha
  );

  const melhorSemCaixa = tentativas.find(t => !t.cruzaCaixa);
  const melhor = melhorSemConflitoForte || melhorSemCruzar || melhorSemCaixa || tentativas[0];

  return montarRotaOrtogonal(
    melhor.points,
    melhor.label,
    melhor.startSide,
    melhor.endSide
  );
}

function construirRotaCompartilhada(start, sharedInfo, posicoes = {}, excludeIds = [], preferredStartSide = null) {
  const mergePoint = { x: sharedInfo.mergePoint.x, y: sharedInfo.mergePoint.y };
  const end = { x: sharedInfo.end.x, y: sharedInfo.end.y };
  const endSide = sharedInfo.endSide;

  return {
    points: buildOrthogonalToMerge(start, mergePoint, end, endSide, posicoes, excludeIds, preferredStartSide),
    label: sharedInfo.label,
    startSide: preferredStartSide,
    endSide
  };
}

function validarRotaCompartilhada(
  rota,
  origem,
  destino,
  posicoes = {},
  routeRegistry = []
) {
  if (!rota || !rota.points || rota.points.length < 2) return false;

  const excludeIds = [origem.id, destino.id, "__INICIO__", "__FIM__"];

  const cruzaCaixa = pathCruzaCaixas(rota.points, posicoes, excludeIds);

  const rotasComparacao = (routeRegistry || []).filter(r =>
    !(r.origemId === origem.id && r.destinoId === destino.id)
  );

  const cruzaLinha = pathCruzaConexoes(rota.points, rotasComparacao);

  return !cruzaCaixa && !cruzaLinha;
}

function podeCompartilharDestino(origem, sharedInfo) {
  if (!sharedInfo) return false;
  return origem.gridCol === sharedInfo.sourceGridCol;
}

function desenharConexao(
  svg,
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  sharedRegistry = {},
  routeRegistry = []
) {
  let rota = escolherRota(origem, destino, {
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes: routeRegistry
  });

  const rotaOriginal = {
    points: [...rota.points],
    label: rota.label,
    startSide: rota.startSide,
    endSide: rota.endSide
  };

  const sharedKey = `${destino.id}__${rota.endSide || "auto"}`;
  const sharedInfo = sharedRegistry[sharedKey];

  if (
    destino.id !== "__FIM__" &&
    destino.id !== "__INICIO__" &&
    sharedInfo &&
    origem.id !== sharedInfo.origemId &&
    podeCompartilharDestino(origem, sharedInfo)
  ) {
    const parPreferido = escolherParesCandidatos(
      origem,
      destino,
      origem.isDecision ? rotulo : ""
    )[0];

    const startReal = getAnchorPoint(origem, parPreferido.startSide);

    const rotaCompartilhada = construirRotaCompartilhada(
      startReal,
      sharedInfo,
      posicoes,
      [origem.id, destino.id, "__INICIO__", "__FIM__"],
      parPreferido.startSide
    );

    // só aceita a rota compartilhada se ela continuar válida
    if (validarRotaCompartilhada(rotaCompartilhada, origem, destino, posicoes, routeRegistry)) {
      rota = rotaCompartilhada;
    } else {
      rota = rotaOriginal;
    }
  } else if (destino.id !== "__FIM__" && destino.id !== "__INICIO__") {
    const end = rota.points[rota.points.length - 1];
    sharedRegistry[sharedKey] = {
      origemId: origem.id,
      sourceGridCol: origem.gridCol,
      endSide: rota.endSide || "left",
      end: { x: end.x, y: end.y },
      mergePoint: getMergePoint(end, rota.endSide || "left"),
      label: rota.label
    };
  }

  const path = criarElementoSVG("path");
  path.setAttribute("d", createPolylinePath(rota.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#111111");
  path.setAttribute("stroke-width", CONFIG.lineWidth);
  path.setAttribute("marker-end", "url(#arrow)");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("data-origem", origem.id);
  path.setAttribute("data-destino", destino.id);
  path.setAttribute("class", "conexao-fluxo");
  svg.appendChild(path);

  routeRegistry.push({
    origemId: origem.id,
    destinoId: destino.id,
    points: rota.points
  });

  if (rotulo) {
    const larguraTexto = medirLarguraTexto(rotulo, 12, "bold");
    const larguraCapsula = Math.max(42, larguraTexto + 20);
    const alturaCapsula = 24;
    const xCapsula = rota.label.x - larguraCapsula / 2;
    const yCapsula = rota.label.y - alturaCapsula / 2 - 1;

    const bg = criarElementoSVG("rect");
    bg.setAttribute("x", xCapsula);
    bg.setAttribute("y", yCapsula);
    bg.setAttribute("width", larguraCapsula);
    bg.setAttribute("height", alturaCapsula);
    bg.setAttribute("rx", alturaCapsula / 2);
    bg.setAttribute("ry", alturaCapsula / 2);
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("stroke", "#111111");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const tx = criarElementoSVG("text");
    tx.setAttribute("x", rota.label.x);
    tx.setAttribute("y", rota.label.y + 4);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-family", CONFIG.fontFamily);
    tx.setAttribute("font-size", "12");
    tx.setAttribute("font-weight", "bold");
    tx.setAttribute("fill", "#111111");
    tx.textContent = rotulo;
    svg.appendChild(tx);
  }
}

function desenharConexaoExcel(
  svg,
  origem,
  destino,
  rotulo = "",
  ordemConexao = 0,
  posicoes = {},
  sharedRegistry = {},
  routeRegistry = []
) {
  let rota = escolherRota(origem, destino, {
    rotulo,
    ordemConexao,
    posicoes,
    rotasExistentes: routeRegistry
  });

  const rotaOriginal = {
    points: [...rota.points],
    label: rota.label,
    startSide: rota.startSide,
    endSide: rota.endSide
  };

  const sharedKey = `${destino.id}__${rota.endSide || "auto"}`;
  const sharedInfo = sharedRegistry[sharedKey];

  if (
    destino.id !== "__FIM__" &&
    destino.id !== "__INICIO__" &&
    sharedInfo &&
    origem.id !== sharedInfo.origemId &&
    podeCompartilharDestino(origem, sharedInfo)
  ) {
    const parPreferido = escolherParesCandidatos(
      origem,
      destino,
      origem.isDecision ? rotulo : ""
    )[0];

    const startReal = getAnchorPoint(origem, parPreferido.startSide);

    const rotaCompartilhada = construirRotaCompartilhada(
      startReal,
      sharedInfo,
      posicoes,
      [origem.id, destino.id, "__INICIO__", "__FIM__"],
      parPreferido.startSide
    );

    // só aceita a rota compartilhada se ela continuar válida
    if (validarRotaCompartilhada(rotaCompartilhada, origem, destino, posicoes, routeRegistry)) {
      rota = rotaCompartilhada;
    } else {
      rota = rotaOriginal;
    }
  } else if (destino.id !== "__FIM__" && destino.id !== "__INICIO__") {
    const end = rota.points[rota.points.length - 1];
    sharedRegistry[sharedKey] = {
      origemId: origem.id,
      sourceGridCol: origem.gridCol,
      endSide: rota.endSide || "left",
      end: { x: end.x, y: end.y },
      mergePoint: getMergePoint(end, rota.endSide || "left"),
      label: rota.label
    };
  }

  const path = criarElementoSVG("path");
  path.setAttribute("d", createPolylinePath(rota.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#111111");
  path.setAttribute("stroke-width", CONFIG.lineWidth);
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);

  routeRegistry.push({
    origemId: origem.id,
    destinoId: destino.id,
    points: rota.points
  });

  const p1 = rota.points[rota.points.length - 2];
  const p2 = rota.points[rota.points.length - 1];

  const arrow = criarElementoSVG("path");
  let dArrow = "";

  if (p2.x > p1.x) {
    dArrow = `M ${p2.x - 10} ${p2.y - 4} L ${p2.x} ${p2.y} L ${p2.x - 10} ${p2.y + 4}`;
  } else if (p2.x < p1.x) {
    dArrow = `M ${p2.x + 10} ${p2.y - 4} L ${p2.x} ${p2.y} L ${p2.x + 10} ${p2.y + 4}`;
  } else if (p2.y > p1.y) {
    dArrow = `M ${p2.x - 4} ${p2.y - 10} L ${p2.x} ${p2.y} L ${p2.x + 4} ${p2.y - 10}`;
  } else {
    dArrow = `M ${p2.x - 4} ${p2.y + 10} L ${p2.x} ${p2.y} L ${p2.x + 4} ${p2.y + 10}`;
  }

  arrow.setAttribute("d", dArrow);
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke", "#111111");
  arrow.setAttribute("stroke-width", CONFIG.lineWidth);
  arrow.setAttribute("stroke-linejoin", "round");
  arrow.setAttribute("stroke-linecap", "round");
  svg.appendChild(arrow);

  if (rotulo) {
    const larguraTexto = medirLarguraTexto(rotulo, 12, "bold");
    const larguraCapsula = Math.max(42, larguraTexto + 20);
    const alturaCapsula = 24;
    const xCapsula = rota.label.x - larguraCapsula / 2;
    const yCapsula = rota.label.y - alturaCapsula / 2 - 1;

    const bg = criarElementoSVG("rect");
    bg.setAttribute("x", xCapsula);
    bg.setAttribute("y", yCapsula);
    bg.setAttribute("width", larguraCapsula);
    bg.setAttribute("height", alturaCapsula);
    bg.setAttribute("rx", alturaCapsula / 2);
    bg.setAttribute("ry", alturaCapsula / 2);
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("stroke", "#111111");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const tx = criarElementoSVG("text");
    tx.setAttribute("x", rota.label.x);
    tx.setAttribute("y", rota.label.y + 4);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-family", CONFIG.fontFamily);
    tx.setAttribute("font-size", "12");
    tx.setAttribute("font-weight", "bold");
    tx.setAttribute("fill", "#111111");
    tx.textContent = rotulo;
    svg.appendChild(tx);
  }
}

function gerarHTMLResumoTempo(lista, tempoTotal) {
  return lista
    .map(item => {
      const pct = tempoTotal ? formatarPercentual((item.tempo / tempoTotal) * 100) : "0,0";
      return '<div class="analytics-item">' +
        escaparHTML(item.nome) +
        ' — <span class="icon-time">⏱</span>' + formatarTempo(item.tempo) +
        ' <span class="icon-pct">%</span>' + pct + '%' +
      '</div>';
    })
    .join("");
}

function gerarTabelaPareto(atividadesTempo, tempoTotal) {
  let acumulado = 0;

  const linhas = atividadesTempo.map((item) => {
    const percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
    acumulado += percentual;

    return (
      '<tr>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;vertical-align:top;">' + escaparHTML(item.atividade) + '</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">⏱ ' + formatarTempo(item.tempo) + '</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">' + formatarPercentual(percentual) + '%</td>' +
        '<td style="padding:8px;border:1px solid #d9d9d9;white-space:nowrap;text-align:center;">' + formatarPercentual(acumulado) + '%</td>' +
      '</tr>'
    );
  }).join("");

  return (
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
        '<thead>' +
          '<tr>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:left;">Atividade</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">Tempo</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">%</th>' +
            '<th style="padding:10px;border:1px solid #d9d9d9;background:#f5f5f5;text-align:center;">Pareto</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + linhas + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

function renderInformacoesProcessoExecutivas(info) {
  return `
    <div class="exec-card">
      <div class="exec-card-title">Informações do Processo</div>
      <div class="exec-info-grid">
        <div class="exec-info-item">
          <div class="exec-info-label">Desenho</div>
          <div class="exec-info-value">${escaparHTML(info.desenho || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Processo</div>
          <div class="exec-info-value">${escaparHTML(info.processo || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Analista</div>
          <div class="exec-info-value">${escaparHTML(info.analista || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Negócio</div>
          <div class="exec-info-value">${escaparHTML(info.negocio || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Área</div>
          <div class="exec-info-value">${escaparHTML(info.area || "Não informado")}</div>
        </div>
        <div class="exec-info-item">
          <div class="exec-info-label">Gestor</div>
          <div class="exec-info-value">${escaparHTML(info.gestor || "Não informado")}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTabelaAnaliseHTML({ titulo, columns, rows }) {
  const thead = `
    <thead>
      <tr>
        ${columns.map(col => `
          <th class="${col.align === "center" ? "th-center" : ""}">
            ${escaparHTML(col.header)}
          </th>
        `).join("")}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.map(row => `
        <tr>
          ${columns.map(col => `
            <td class="${col.align === "center" ? "td-center" : ""}">
              ${escaparHTML(row[col.key] ?? "")}
            </td>
          `).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

  return `
    <div class="exec-table-block">
      <div class="exec-table-title">${escaparHTML(titulo)}</div>
      <div class="exec-table-wrap">
        <table class="exec-table">
          ${thead}
          ${tbody}
        </table>
      </div>
    </div>
  `;
}

function renderResumoAnaliseExecutivo(dados) {
  return `
    <div class="exec-summary-grid">
      <div class="exec-summary-item">
        <div class="exec-summary-label">Tempo total do processo</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoTotal)}</div>
      </div>
      <div class="exec-summary-item">
        <div class="exec-summary-label">Loops detectados</div>
        <div class="exec-summary-value">${dados.loops}</div>
      </div>
      <div class="exec-summary-item">
        <div class="exec-summary-label">Potencial retrabalho</div>
        <div class="exec-summary-value">${formatarTempo(dados.tempoPotencialRetrabalho)} | ${formatarPercentual(dados.impactoPotencialRetrabalho)}%</div>
      </div>
      <div class="exec-summary-item">
        <div class="exec-summary-label">Taxa de decisão</div>
        <div class="exec-summary-value">${dados.decisoes} etapa(s) | ${formatarPercentual(dados.taxaDecisao)}%</div>
      </div>
    </div>
  `;
}

function renderizarAnaliseExecutiva(dados) {
  const top3Rows = dados.top3Gargalos.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const tipoRows = dados.tempoPorTipo.map(item => ({
    tipo: item.tipo,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const sistemaRows = dados.tempoPorSistema.map(item => ({
    sistema: item.sistema,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`
  }));

  const paretoRows = dados.pareto.map(item => ({
    atividade: item.atividade,
    tempoFmt: formatarTempo(item.tempo),
    percentualFmt: `${formatarPercentual(item.percentual)}%`,
    paretoFmt: `${formatarPercentual(item.pareto)}%`
  }));

  return `
    <div class="exec-card">
      <div class="exec-card-title">Análise do Processo</div>

      ${renderResumoAnaliseExecutivo(dados)}

      ${renderTabelaAnaliseHTML({
        titulo: "Top 3 Gargalos",
        columns: [
          { header: "Atividade", key: "atividade", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: top3Rows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Tempo por Tipo",
        columns: [
          { header: "Tipo", key: "tipo", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: tipoRows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Tempo por Sistema",
        columns: [
          { header: "Sistema", key: "sistema", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" }
        ],
        rows: sistemaRows
      })}

      ${renderTabelaAnaliseHTML({
        titulo: "Pareto de Tempo",
        columns: [
          { header: "Atividade", key: "atividade", align: "left" },
          { header: "Tempo (horas)", key: "tempoFmt", align: "center" },
          { header: "%", key: "percentualFmt", align: "center" },
          { header: "Pareto", key: "paretoFmt", align: "center" }
        ],
        rows: paretoRows
      })}
    </div>
  `;
}

function obterEtapasDaTabela() {
  const etapasValidas = fluxoData.filter(linha => limpar(linha.atividade || "") !== "");

  const uidParaId = {};
  etapasValidas.forEach((linha, index) => {
    uidParaId[linha.uid] = gerarIdVisual(index);
  });

  return etapasValidas.map((linha, index) => {
    const tempoTexto = limpar(linha.tempo || "");

    return {
      ordem: index + 1,
      id: uidParaId[linha.uid],
      atividade: limpar(linha.atividade || ""),
      area: limpar(linha.area || "") || "Sem Área",
      tipo: limpar(linha.tipo || "") || "Não informado",
      sistema: limpar(linha.sistema || "") || "Sem sistema informado",
      tempoTexto,
      tempo: tempoTexto ? tempoParaSegundos(tempoTexto) : 0,
      proxSim: uidParaId[linha.proxSim] || "",
      proxNao: uidParaId[linha.proxNao] || "",
      conexoesExtras: (Array.isArray(linha.extras) ? linha.extras : [])
        .map(uid => uidParaId[uid] || "")
        .filter(Boolean)
        .join(","),
      coluna: Math.max(1, Number(linha.coluna) || 1),
      linha: Math.max(1, Number(linha.linha) || 1),
      cor: normalizarCor(linha.cor || "white")
    };
  });
}

function gerarFluxo() {
  if (!fluxoData || fluxoData.length === 0) {
    mostrarToast("Preencha a tabela ou importe um Excel antes de gerar o fluxo.", "alerta");
    return;
  }

  const etapas = obterEtapasDaTabela();

  if (!etapas.length) {
    mostrarToast("Nenhuma etapa válida foi encontrada na tabela.", "alerta");
    return;
  }

  const desenho = obterValorCampo("desenho");
  const processo = obterValorCampo("processo");
  const analista = obterValorCampo("analista");
  const negocio = obterValorCampo("negocio");
  const area = obterValorCampo("area");
  const gestor = obterValorCampo("gestor");

  const idsValidos = new Set(etapas.map(e => e.id));

  etapas.sort((a, b) => a.ordem - b.ordem);

  const etapaPorId = {};
  etapas.forEach(e => {
    etapaPorId[e.id] = e;
  });

  const alturaPadraoNos = calcularAlturaPadraoNos(etapas);
  const maiorAlturaLosango = Math.ceil(alturaPadraoNos * CONFIG.decisionHeightFactor);
  const rowSlotHeight = Math.max(alturaPadraoNos, maiorAlturaLosango);
  const colSlotWidth = Math.max(CONFIG.boxWidth, CONFIG.decisionWidth);

  const maxColuna = Math.max(...etapas.map(e => e.coluna), 1) + 1;

  const areasOrdenadas = [];
  const areaJaExiste = new Set();
  etapas.forEach((e) => {
    const nome = e.area || "Sem Área";
    if (!areaJaExiste.has(nome)) {
      areaJaExiste.add(nome);
      areasOrdenadas.push(nome);
    }
  });

  // Aplica a ordem manual das raias (editor). Áreas sem ordem definida
  // vão para o fim, preservando a ordem natural de aparição.
  if (Array.isArray(ordemRaias) && ordemRaias.length) {
    areasOrdenadas.sort((a, b) => {
      const ia = ordemRaias.indexOf(a);
      const ib = ordemRaias.indexOf(b);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }
  ultimasAreasOrdenadas = [...areasOrdenadas];

  const linhasPorArea = {};
  areasOrdenadas.forEach((nome) => {
    linhasPorArea[nome] = 1;
  });

  etapas.forEach((e) => {
    const nome = e.area || "Sem Área";
    linhasPorArea[nome] = Math.max(linhasPorArea[nome] || 1, e.linha || 1);
  });

  const laneContentWidth =
    maxColuna * colSlotWidth +
    (maxColuna - 1) * CONFIG.colGap;

  const lanes = {};
  let cursorY = CONFIG.marginY;
  let rowOffsetGlobal = 0;

  areasOrdenadas.forEach((nome) => {
    const qtdLinhas = linhasPorArea[nome] || 1;

    const contentHeight =
      qtdLinhas * rowSlotHeight +
      (qtdLinhas - 1) * CONFIG.rowGap;

    const laneHeight =
      CONFIG.lanePaddingTop +
      contentHeight +
      CONFIG.lanePaddingBottom;

    lanes[nome] = {
      x: CONFIG.marginX,
      y: cursorY,
      width: CONFIG.laneLabelWidth + CONFIG.laneEntryWidth + laneContentWidth,
      height: laneHeight,
      contentX: CONFIG.marginX + CONFIG.laneLabelWidth + CONFIG.laneEntryWidth,
      contentY: cursorY + CONFIG.lanePaddingTop,
      rows: qtdLinhas,
      rowOffsetGlobalStart: rowOffsetGlobal
    };

    rowOffsetGlobal += qtdLinhas + 2;
    cursorY += laneHeight + CONFIG.laneGap;
  });

  const svgWidth =
    CONFIG.marginX * 2 +
    CONFIG.laneLabelWidth +
    CONFIG.laneEntryWidth +
    laneContentWidth;

  const svgHeight = cursorY;

  const svg = criarElementoSVG("svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", svgWidth);
  svg.setAttribute("height", svgHeight);
  svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
  svg.setAttribute("style", "background:#ffffff");

  const style = criarElementoSVG("style");
  style.textContent = `
    .box {
      stroke: #111111;
      stroke-width: 2;
    }

    .green { fill: #95d5b2; }
    .blue { fill: #8ecae6; }
    .yellow { fill: #ffd166; }
    .red { fill: #ef476f; }
    .white { fill: #ffffff; }

    .system {
      fill: #f5f5f5;
      stroke: #111111;
      stroke-width: 1.5;
    }

    .text {
      font-family: Arial, sans-serif;
      fill: #111111;
    }
  `;
  svg.appendChild(style);

  const defs = criarElementoSVG("defs");
  const marker = criarElementoSVG("marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const markerPath = criarElementoSVG("path");
  markerPath.setAttribute("d", "M0,0 L10,3 L0,6 Z");
  markerPath.setAttribute("fill", "#111111");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  desenharRaias(svg, areasOrdenadas, lanes, svgWidth);

  const posicoes = {};

  etapas.forEach((e) => {
    const pergunta = ehDecisao(e);
    const w = pergunta ? CONFIG.decisionWidth : CONFIG.boxWidth;
    const h = obterAlturaNo(e, alturaPadraoNos);
    const lane = lanes[e.area || "Sem Área"];

    const slotX = lane.contentX + (e.coluna - 1) * (colSlotWidth + CONFIG.colGap);
    const slotY = lane.contentY + (e.linha - 1) * (rowSlotHeight + CONFIG.rowGap);

    const x = slotX + (colSlotWidth - w) / 2;
    const y = slotY + (rowSlotHeight - h) / 2;

    posicoes[e.id] = {
      id: e.id,
      x,
      y,
      w,
      h,
      isDecision: pergunta,
      gridCol: e.coluna,
      gridRow: e.linha,
      gridRowGlobal: lane.rowOffsetGlobalStart + e.linha,
      area: e.area || "Sem Área",
      laneTop: lane.y + CONFIG.lanePaddingTop,
      laneBottom: lane.y + lane.height - CONFIG.lanePaddingBottom
    };
  });

  const primeiraEtapa = etapas[0];
  const ultimaEtapa = etapas[etapas.length - 1];
  const primeiraPos = posicoes[primeiraEtapa.id];
  const ultimaPos = posicoes[ultimaEtapa.id];

  const primeiraLane = lanes[primeiraEtapa.area];

  posicoes["__INICIO__"] = {
    id: "__INICIO__",
    x: primeiraLane.x + CONFIG.laneLabelWidth + 20,
    y: primeiraPos.y + (primeiraPos.h - 36) / 2,
    w: 60,
    h: 36,
    isDecision: false,
    gridCol: Math.max(0, primeiraPos.gridCol - 1),
    gridRow: primeiraPos.gridRow,
    gridRowGlobal: primeiraPos.gridRowGlobal,
    area: primeiraPos.area
  };

  posicoes["__FIM__"] = {
    id: "__FIM__",
    x: ultimaPos.x + ultimaPos.w + CONFIG.entryExitGap,
    y: ultimaPos.y + (ultimaPos.h - 36) / 2,
    w: 60,
    h: 36,
    isDecision: false,
    gridCol: ultimaPos.gridCol + 1,
    gridRow: ultimaPos.gridRow,
    gridRowGlobal: ultimaPos.gridRowGlobal,
    area: ultimaPos.area
  };

  desenharCapsula(svg, "Início", posicoes["__INICIO__"].x, posicoes["__INICIO__"].y, 60, 36);
  desenharCapsula(svg, "Fim", posicoes["__FIM__"].x, posicoes["__FIM__"].y, 60, 36);

  etapas.forEach((etapa) => {
    desenharNo(svg, etapa, posicoes[etapa.id]);
  });

  let loops = 0;
  let decisoes = 0;
  let conexoesExtrasCount = 0;
  const etapasImpactadasRetrabalho = new Set();
  const sharedRegistry = {};
  const routeRegistry = [];

  desenharConexao(
    svg,
    posicoes["__INICIO__"],
    posicoes[primeiraEtapa.id],
    "",
    0,
    posicoes,
    sharedRegistry,
    routeRegistry
  );

  etapas.forEach((etapa) => {
    const origem = posicoes[etapa.id];
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    const pergunta = ehDecisao(etapa);
    if (pergunta) decisoes++;

    destinosSim.forEach((destinoId, indice) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      desenharConexao(
        svg,
        origem,
        posicoes[destinoId],
        pergunta ? (indice === 0 ? "Sim" : `Sim ${indice + 1}`) : "",
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosNao.forEach((destinoId, indice) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      desenharConexao(
        svg,
        origem,
        posicoes[destinoId],
        pergunta ? (indice === 0 ? "Não" : `Não ${indice + 1}`) : (indice === 0 ? "Não" : `Não ${indice + 1}`),
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosExtras.forEach((destinoId, indice) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops += adicionarLoopSeNecessario(etapa.id, destinoId, etapaPorId, etapa);
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }

      conexoesExtrasCount++;
      desenharConexao(
        svg,
        origem,
        posicoes[destinoId],
        "",
        indice + 1,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });
  });

  etapas.forEach((etapa) => {
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    if (destinosSim.length === 0 && destinosNao.length === 0 && destinosExtras.length === 0) {
      desenharConexao(
        svg,
        posicoes[etapa.id],
        posicoes["__FIM__"],
        "",
        0,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    }
  });

  document.getElementById("diagram").innerHTML = "";
  document.getElementById("diagram").appendChild(svg);
  atualizarBarraRolagemSuperior();

  ultimoNomeArquivo = gerarNomeArquivo();

  let tempoTotal = 0;
  const atividadesTempo = [];
  const tiposTempo = {};
  const sistemasTempo = {};

  etapas.forEach((etapa) => {
    tempoTotal += etapa.tempo;
    atividadesTempo.push({ atividade: etapa.atividade, tempo: etapa.tempo });

    if (!tiposTempo[etapa.tipo]) tiposTempo[etapa.tipo] = 0;
    tiposTempo[etapa.tipo] += etapa.tempo;

    if (!sistemasTempo[etapa.sistema]) sistemasTempo[etapa.sistema] = 0;
    sistemasTempo[etapa.sistema] += etapa.tempo;
  });

  atividadesTempo.sort((a, b) => b.tempo - a.tempo);

  const tiposOrdenados = Object.entries(tiposTempo)
    .map(([nome, tempo]) => ({ nome, tempo }))
    .sort((a, b) => b.tempo - a.tempo);

  const sistemasOrdenados = Object.entries(sistemasTempo)
    .map(([nome, tempo]) => ({ nome, tempo }))
    .sort((a, b) => b.tempo - a.tempo);

  let tempoPotencialRetrabalho = 0;
  etapas.forEach((etapa) => {
    if (etapasImpactadasRetrabalho.has(etapa.id)) {
      tempoPotencialRetrabalho += etapa.tempo;
    }
  });

  const impactoPotencialRetrabalhoNum = tempoTotal
    ? (tempoPotencialRetrabalho / tempoTotal) * 100
    : 0;

  const taxaDecisaoNum = etapas.length
    ? (decisoes / etapas.length) * 100
    : 0;

  const infoProcessoData = {
    desenho,
    processo,
    analista,
    negocio,
    area,
    gestor
  };

  document.getElementById("infoProcesso").innerHTML =
    renderInformacoesProcessoExecutivas(infoProcessoData);

  const dadosAnalise = {
    tempoTotal,
    loops,
    conexoesExtrasCount,
    tempoPotencialRetrabalho,
    impactoPotencialRetrabalho: impactoPotencialRetrabalhoNum,
    decisoes,
    taxaDecisao: taxaDecisaoNum,
    top3Gargalos: atividadesTempo.slice(0, 3).map(item => ({
      atividade: item.atividade,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    tempoPorTipo: tiposOrdenados.map(item => ({
      tipo: item.nome,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    tempoPorSistema: sistemasOrdenados.map(item => ({
      sistema: item.nome,
      tempo: item.tempo,
      percentual: tempoTotal ? (item.tempo / tempoTotal) * 100 : 0
    })),
    pareto: (() => {
      let acumulado = 0;
      return atividadesTempo.map(item => {
        const percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
        acumulado += percentual;
        return {
          atividade: item.atividade,
          tempo: item.tempo,
          percentual,
          pareto: acumulado
        };
      });
    })()
  };

  document.getElementById("metricas").innerHTML =
    renderizarAnaliseExecutiva(dadosAnalise);

  // Se o modo de edição estiver ligado, reativa os controles sobre o novo SVG.
  if (modoEdicaoAtivo) {
    aplicarCamadaEdicao();
    renderPainelRaias();
  }
}

function quebrarNomeRaiaExcel(texto, alturaDisponivel) {
  const nome = String(texto || "").trim();
  if (!nome) return [""];

  const fontSize = CONFIG.laneHeaderFontSize;
  const fontWeight = "bold";
  const margemVertical = 16;
  const larguraUtil = Math.max(80, alturaDisponivel - margemVertical * 2);

  // cabe em 1 linha
  if (medirLarguraTexto(nome, fontSize, fontWeight) <= larguraUtil) {
    return [nome];
  }

  const palavras = nome.split(/\s+/).filter(Boolean);

  // tenta quebrar em 2 linhas equilibradas
  if (palavras.length >= 2) {
    let melhor = null;

    for (let i = 1; i < palavras.length; i++) {
      const linha1 = palavras.slice(0, i).join(" ");
      const linha2 = palavras.slice(i).join(" ");

      const w1 = medirLarguraTexto(linha1, fontSize, fontWeight);
      const w2 = medirLarguraTexto(linha2, fontSize, fontWeight);
      const maior = Math.max(w1, w2);
      const diferenca = Math.abs(w1 - w2);
      const cabe = maior <= larguraUtil;

      const candidato = {
        linhas: [linha1, linha2],
        cabe,
        score: (cabe ? 0 : 100000) + maior + diferenca * 0.3
      };

      if (!melhor || candidato.score < melhor.score) {
        melhor = candidato;
      }
    }

    if (melhor) return melhor.linhas;
  }

  // fallback: quebra automática e limita em 2 linhas
  const linhasAuto = quebrarTextoPorLargura(nome, larguraUtil, fontSize, fontWeight);

  if (linhasAuto.length <= 2) return linhasAuto;

  const meio = Math.ceil(linhasAuto.length / 2);
  return [
    linhasAuto.slice(0, meio).join(" "),
    linhasAuto.slice(meio).join(" ")
  ];
}

function calcularLarguraFaixaRaiaExcel(lanesBase) {
  const lineHeight = CONFIG.laneHeaderFontSize + 4;

  let maxLinhas = 1;

  lanesBase.forEach((lane) => {
    const linhas = quebrarNomeRaiaExcel(lane.area, lane.height);
    lane.labelLines = linhas;
    maxLinhas = Math.max(maxLinhas, linhas.length);
  });

  // largura da faixa baseada na quantidade máxima de linhas
  // com uma folga maior para não ficar apertado
  return Math.max(
    EXCEL_LAYOUT.laneLabelWidth,
    maxLinhas * lineHeight + 24
  );
}

function ajustarViewBoxAoConteudo(svg, folga = 0) {
  if (!svg) return svg;

  let bbox = null;
  let wrapper = null;

  try {
    // getBBox costuma falhar quando o SVG ainda não está no DOM.
    wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "-100000px";
    wrapper.style.visibility = "hidden";
    wrapper.style.pointerEvents = "none";
    wrapper.style.width = "0";
    wrapper.style.height = "0";
    wrapper.style.overflow = "hidden";

    document.body.appendChild(wrapper);
    wrapper.appendChild(svg);

    bbox = svg.getBBox();
  } catch (e) {
    bbox = null;
  } finally {
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }

  if (
    !bbox ||
    !Number.isFinite(bbox.x) ||
    !Number.isFinite(bbox.y) ||
    !Number.isFinite(bbox.width) ||
    !Number.isFinite(bbox.height) ||
    bbox.width <= 0 ||
    bbox.height <= 0
  ) {
    // fallback: mantém dimensões existentes e evita gerar SVG 1x1
    const larguraAtual = Number(svg.getAttribute("width")) || 1000;
    const alturaAtual = Number(svg.getAttribute("height")) || 800;

    svg.setAttribute("viewBox", `0 0 ${larguraAtual} ${alturaAtual}`);
    svg.setAttribute("width", larguraAtual);
    svg.setAttribute("height", alturaAtual);
    return svg;
  }

  const x = bbox.x - folga;
  const y = bbox.y - folga;
  const width = bbox.width + folga * 2;
  const height = bbox.height + folga * 2;

  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  return svg;
}

function gerarFluxoExcel() {
  if (!fluxoData || fluxoData.length === 0) {
    mostrarToast("Preencha a tabela antes de exportar.", "alerta");
    return null;
  }

  const etapas = obterEtapasDaTabela();

  if (!etapas.length) {
    mostrarToast("Nenhuma etapa válida foi encontrada na tabela.", "alerta");
    return null;
  }

  const idsValidos = new Set(etapas.map(e => e.id));

  etapas.sort((a, b) => a.ordem - b.ordem);

  const etapaPorId = {};
  etapas.forEach(e => {
    etapaPorId[e.id] = e;
  });

  const alturaPadraoNos = calcularAlturaPadraoNos(etapas);
  const maiorAlturaLosango = Math.ceil(alturaPadraoNos * CONFIG.decisionHeightFactor);
  const rowSlotHeight = Math.max(alturaPadraoNos, maiorAlturaLosango);
  const colSlotWidth = Math.max(CONFIG.boxWidth, CONFIG.decisionWidth);

  const maxColuna = Math.max(...etapas.map(e => e.coluna), 1) + 1;

  const areasOrdenadas = [];
  const areaJaExiste = new Set();

  etapas.forEach((e) => {
    const nome = e.area || "Sem Área";
    if (!areaJaExiste.has(nome)) {
      areaJaExiste.add(nome);
      areasOrdenadas.push(nome);
    }
  });

  // Respeita a ordem manual das raias definida no editor (mesma regra da tela).
  if (Array.isArray(ordemRaias) && ordemRaias.length) {
    areasOrdenadas.sort((a, b) => {
      const ia = ordemRaias.indexOf(a);
      const ib = ordemRaias.indexOf(b);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }

  let cursorY = 0;
  let rowOffsetGlobal = 0;
  const lanesBase = [];

  areasOrdenadas.forEach((nomeArea) => {
    const etapasArea = etapas.filter(e => (e.area || "Sem Área") === nomeArea);
    const maxLinhaArea = Math.max(...etapasArea.map(e => e.linha), 1);
    const qtdLinhas = maxLinhaArea;

    const contentHeight =
      qtdLinhas * rowSlotHeight +
      (qtdLinhas - 1) * EXCEL_LAYOUT.rowGap;

    const laneHeight =
      EXCEL_LAYOUT.lanePaddingTop +
      contentHeight +
      EXCEL_LAYOUT.lanePaddingBottom;

    lanesBase.push({
      area: nomeArea,
      y: cursorY,
      height: laneHeight,
      contentHeight,
      rows: qtdLinhas,
      rowOffsetGlobalStart: rowOffsetGlobal
    });

    rowOffsetGlobal += qtdLinhas + 2;
    cursorY += laneHeight + EXCEL_LAYOUT.laneGap;
  });

  const laneLabelWidthExcel = calcularLarguraFaixaRaiaExcel(lanesBase);

  const laneContentWidth =
    maxColuna * colSlotWidth +
    (maxColuna - 1) * EXCEL_LAYOUT.colGap;

  const lanes = lanesBase.map((base) => ({
    area: base.area,
    x: EXCEL_LAYOUT.extraLeftPadding,
    y: base.y,
    width: laneLabelWidthExcel + EXCEL_LAYOUT.laneEntryWidth + EXCEL_LAYOUT.laneTextOffsetLeft + laneContentWidth,
    height: base.height,
    contentX: EXCEL_LAYOUT.extraLeftPadding + laneLabelWidthExcel + EXCEL_LAYOUT.laneEntryWidth + EXCEL_LAYOUT.laneTextOffsetLeft,
    contentY: base.y + EXCEL_LAYOUT.lanePaddingTop,
    contentHeight: base.contentHeight,
    rows: base.rows,
    rowOffsetGlobalStart: base.rowOffsetGlobalStart,
    labelWidth: laneLabelWidthExcel,
    labelLines: base.labelLines || [base.area]
  }));

  const larguraSvg = Math.max(...lanes.map(l => l.x + l.width), 0);
  const alturaSvg = lanes.length ? lanes[lanes.length - 1].y + lanes[lanes.length - 1].height : 0;

  const svg = criarElementoSVG("svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", larguraSvg);
  svg.setAttribute("height", alturaSvg);
  svg.setAttribute("viewBox", `0 0 ${larguraSvg} ${alturaSvg}`);
  svg.setAttribute("style", "background:transparent");

  desenharRaiasExcel(svg, lanes);

  const laneByArea = {};
  lanes.forEach(lane => {
    laneByArea[lane.area] = lane;
  });

  const posicoes = {};

  etapas.forEach((e) => {
    const lane = laneByArea[e.area || "Sem Área"];
    const slotX = lane.contentX + (e.coluna - 1) * (colSlotWidth + EXCEL_LAYOUT.colGap);
    const slotY = lane.contentY + (e.linha - 1) * (rowSlotHeight + EXCEL_LAYOUT.rowGap);

    const pergunta = ehDecisao(e);
    const w = pergunta ? CONFIG.decisionWidth : CONFIG.boxWidth;
    const h = obterAlturaNo(e, alturaPadraoNos);

    const x = slotX + (colSlotWidth - w) / 2;
    const y = slotY + (rowSlotHeight - h) / 2;

    posicoes[e.id] = {
      id: e.id,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      top: y,
      bottom: y + h,
      left: x,
      right: x + w,
      isDecision: pergunta,
      gridCol: e.coluna,
      gridRow: e.linha,
      gridRowGlobal: lane.rowOffsetGlobalStart + e.linha,
      area: e.area || "Sem Área",
      laneTop: lane.y + EXCEL_LAYOUT.lanePaddingTop,
      laneBottom: lane.y + lane.height - EXCEL_LAYOUT.lanePaddingBottom
    };
  });

  const primeiraEtapa = etapas[0];
  const ultimaEtapa = etapas[etapas.length - 1];
  const primeiraPos = posicoes[primeiraEtapa.id];
  const ultimaPos = posicoes[ultimaEtapa.id];
  const lanePrimeira = laneByArea[primeiraEtapa.area || "Sem Área"];
  const laneUltima = laneByArea[ultimaEtapa.area || "Sem Área"];

  posicoes["__INICIO__"] = {
    id: "__INICIO__",
    x: primeiraPos.x - 60 - EXCEL_LAYOUT.startGap,
    y: primeiraPos.cy - 18,
    w: 60,
    h: 36,
    cx: primeiraPos.x - EXCEL_LAYOUT.startGap - 30,
    cy: primeiraPos.cy,
    top: primeiraPos.cy - 18,
    bottom: primeiraPos.cy + 18,
    left: primeiraPos.x - 60 - EXCEL_LAYOUT.startGap,
    right: primeiraPos.x - EXCEL_LAYOUT.startGap,
    isDecision: false,
    gridCol: 0,
    gridRow: primeiraEtapa.linha,
    gridRowGlobal: lanePrimeira.rowOffsetGlobalStart + primeiraEtapa.linha,
    area: primeiraEtapa.area || "Sem Área"
  };

  posicoes["__FIM__"] = {
    id: "__FIM__",
    x: ultimaPos.x + ultimaPos.w + EXCEL_LAYOUT.endGap,
    y: ultimaPos.cy - 18,
    w: 60,
    h: 36,
    cx: ultimaPos.x + ultimaPos.w + EXCEL_LAYOUT.endGap + 30,
    cy: ultimaPos.cy,
    top: ultimaPos.cy - 18,
    bottom: ultimaPos.cy + 18,
    left: ultimaPos.x + ultimaPos.w + EXCEL_LAYOUT.endGap,
    right: ultimaPos.x + ultimaPos.w + EXCEL_LAYOUT.endGap + 60,
    isDecision: false,
    gridCol: ultimaEtapa.coluna + 1,
    gridRow: ultimaEtapa.linha,
    gridRowGlobal: laneUltima.rowOffsetGlobalStart + ultimaEtapa.linha,
    area: ultimaEtapa.area || "Sem Área"
  };

  desenharCapsula(svg, "Início", posicoes["__INICIO__"].x, posicoes["__INICIO__"].y, 60, 36);
  desenharCapsula(svg, "Fim", posicoes["__FIM__"].x, posicoes["__FIM__"].y, 60, 36);

  etapas.forEach((etapa) => {
    desenharNoExcel(svg, etapa, posicoes[etapa.id]);
  });

  const sharedRegistry = {};
  const routeRegistry = [];

  desenharConexaoExcel(
    svg,
    posicoes["__INICIO__"],
    posicoes[primeiraEtapa.id],
    "",
    0,
    posicoes,
    sharedRegistry,
    routeRegistry
  );

  etapas.forEach((etapa) => {
    const origem = posicoes[etapa.id];
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    const pergunta = ehDecisao(etapa);

    destinosSim.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        pergunta ? (indice === 0 ? "Sim" : `Sim ${indice + 1}`) : "",
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosNao.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        pergunta ? (indice === 0 ? "Não" : `Não ${indice + 1}`) : (indice === 0 ? "Não" : `Não ${indice + 1}`),
        indice,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });

    destinosExtras.forEach((destinoId, indice) => {
      desenharConexaoExcel(
        svg,
        origem,
        posicoes[destinoId],
        "",
        indice + 1,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    });
  });

  etapas.forEach((etapa) => {
    const destinosSim = quebrarListaIds(etapa.proxSim).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosNao = quebrarListaIds(etapa.proxNao).filter(destino => destinoEhValido(destino, idsValidos));
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras).filter(destino => destinoEhValido(destino, idsValidos));

    if (destinosSim.length === 0 && destinosNao.length === 0 && destinosExtras.length === 0) {
      desenharConexaoExcel(
        svg,
        posicoes[etapa.id],
        posicoes["__FIM__"],
        "",
        0,
        posicoes,
        sharedRegistry,
        routeRegistry
      );
    }
  });

  svg.setAttribute("viewBox", `0 0 ${larguraSvg} ${alturaSvg}`);
  svg.setAttribute("width", larguraSvg);
  svg.setAttribute("height", alturaSvg);  
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

return aplicarEscalaSVGExcel(svg, EXCEL_EXPORT_SCALE); 
}

/* =========================
   EXPORTAÇÃO SVG E PDF
========================= */

function obterSVGPronto() {
  const svgOriginal = document.querySelector("#diagram svg");
  if (!svgOriginal) {
    mostrarToast("Gere o fluxo primeiro.", "alerta");
    return null;
  }
  const clone = svgOriginal.cloneNode(true);

  // Remove toda a camada de edição e marcações, garantindo export limpo.
  clone.querySelectorAll("g.editor-ui").forEach(el => el.remove());
  clone.querySelectorAll("[data-origem]").forEach(el => {
    el.removeAttribute("data-origem");
    el.removeAttribute("data-destino");
    if (el.getAttribute("class") === "conexao-fluxo") el.removeAttribute("class");
    el.classList && el.classList.remove("conexao-selecionada");
  });

  return clone;
}

function coletarDadosAnaliseEstruturados() {
  if (!fluxoData || fluxoData.length === 0) return null;

  const etapas = obterEtapasDaTabela();
  if (!etapas.length) return null;

  etapas.sort((a, b) => a.ordem - b.ordem);

  const etapaPorId = {};
  etapas.forEach(e => {
    etapaPorId[e.id] = e;
  });

  let tempoTotal = 0;
  let loops = 0;
  let decisoes = 0;
  let conexoesExtrasCount = 0;

  const etapasImpactadasRetrabalho = new Set();
  const tiposTempo = {};
  const sistemasTempo = {};

  etapas.forEach((etapa) => {
    tempoTotal += etapa.tempo;

    if (ehDecisao(etapa)) decisoes++;

    if (!tiposTempo[etapa.tipo]) tiposTempo[etapa.tipo] = 0;
    tiposTempo[etapa.tipo] += etapa.tempo;

    if (!sistemasTempo[etapa.sistema]) sistemasTempo[etapa.sistema] = 0;
    sistemasTempo[etapa.sistema] += etapa.tempo;

    const destinosSim = quebrarListaIds(etapa.proxSim);
    const destinosNao = quebrarListaIds(etapa.proxNao);
    const destinosExtras = quebrarListaIds(etapa.conexoesExtras);

    destinosSim.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });

    destinosNao.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });

    conexoesExtrasCount += destinosExtras.length;

    destinosExtras.forEach((destinoId) => {
      const destino = etapaPorId[destinoId];
      if (destino && destino.ordem < etapa.ordem) {
        loops++;
        adicionarEtapasImpactadasPorRetorno(etapa.id, destinoId, etapaPorId, etapas, etapasImpactadasRetrabalho);
      }
    });
  });

  let tempoPotencialRetrabalho = 0;
  etapas.forEach((etapa) => {
    if (etapasImpactadasRetrabalho.has(etapa.id)) {
      tempoPotencialRetrabalho += etapa.tempo;
    }
  });

  const impactoPotencialRetrabalho = tempoTotal
    ? (tempoPotencialRetrabalho / tempoTotal) * 100
    : 0;

  const taxaDecisao = etapas.length
    ? (decisoes / etapas.length) * 100
    : 0;

  const top3Gargalos = [...etapas]
    .sort((a, b) => b.tempo - a.tempo)
    .slice(0, 3)
    .map((e) => ({
      atividade: e.atividade,
      tempo: e.tempo,
      percentual: tempoTotal ? (e.tempo / tempoTotal) * 100 : 0
    }));

  const tempoPorTipo = Object.entries(tiposTempo)
    .map(([tipo, tempo]) => ({
      tipo,
      tempo,
      percentual: tempoTotal ? (tempo / tempoTotal) * 100 : 0
    }))
    .sort((a, b) => b.tempo - a.tempo);

  const tempoPorSistema = Object.entries(sistemasTempo)
    .map(([sistema, tempo]) => ({
      sistema,
      tempo,
      percentual: tempoTotal ? (tempo / tempoTotal) * 100 : 0
    }))
    .sort((a, b) => b.tempo - a.tempo);

  const pareto = [...etapas]
    .sort((a, b) => b.tempo - a.tempo)
    .map((e) => ({
      atividade: e.atividade,
      tempo: e.tempo
    }));

  let acumulado = 0;
  pareto.forEach((item) => {
    item.percentual = tempoTotal ? (item.tempo / tempoTotal) * 100 : 0;
    acumulado += item.percentual;
    item.pareto = acumulado;
  });

  return {
    tempoTotal,
    loops,
    conexoesExtrasCount,
    tempoPotencialRetrabalho,
    impactoPotencialRetrabalho,
    decisoes,
    taxaDecisao,
    top3Gargalos,
    tempoPorTipo,
    tempoPorSistema,
    pareto
  };
}

function extrairLinhasInfoProcesso() {
  const el = document.getElementById("infoProcesso");
  if (!el) return [];

  const labels = el.querySelectorAll(".exec-info-item");
  if (labels.length) {
    return Array.from(labels).map(item => {
      const label = item.querySelector(".exec-info-label")?.innerText?.trim() || "";
      const value = item.querySelector(".exec-info-value")?.innerText?.trim() || "";
      return `${label}: ${value}`;
    });
  }

  return el.innerText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

function adicionarTextoQuebrado(doc, texto, x, y, maxWidth, lineHeight = 14, options = {}) {
  const linhas = doc.splitTextToSize(String(texto || ""), maxWidth);
  if (linhas.length === 0) return y;
  doc.text(linhas, x, y, options);
  return y + linhas.length * lineHeight;
}

function garantirEspacoPagina(doc, yAtual, alturaNecessaria, margem, pageHeight, onNewPage = null) {
  if (yAtual + alturaNecessaria > pageHeight - margem) {
    doc.addPage();
    let novoY = margem;
    if (typeof onNewPage === "function") {
      novoY = onNewPage(novoY);
    }
    return novoY;
  }
  return yAtual;
}

function limparTextoPDF(txt) {
  return String(txt || "")
    .replace(/⏱/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function desenharTabelaPDF(doc, config) {
  const {
    titulo,
    columns,
    rows,
    x,
    yInicial,
    larguraTotal,
    margem,
    pageHeight
  } = config;

  const borderWidth = 0.6;
  const cellPaddingX = 6;
  const lineHeight = 11;
  const minRowHeight = 20;
  const gapAntesTitulo = 16;
  const gapTituloCabecalho = 6;
  const gapDepoisTabela = 22;

  let y = yInicial + gapAntesTitulo;

  const weights = columns.map(col => col.weight || 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colWidths = weights.map(w => (larguraTotal * w) / totalWeight);

  const getHeaderHeight = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    let maxLines = 1;
    columns.forEach((col, i) => {
      const linhas = doc.splitTextToSize(col.header, colWidths[i] - cellPaddingX * 2);
      if (linhas.length > maxLines) maxLines = linhas.length;
    });

    return Math.max(minRowHeight, maxLines * lineHeight + 12);
  };

  const getCellBlock = (valor, width, align) => {
    if (align === "left") {
      return doc.splitTextToSize(valor, width - cellPaddingX * 2);
    }
    return [valor];
  };

  const drawTableHeader = (yHeader) => {
    const headerHeight = getHeaderHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let currentX = x;

    columns.forEach((col, i) => {
      const width = colWidths[i];
      const linhas = doc.splitTextToSize(col.header, width - cellPaddingX * 2);

      doc.rect(currentX, yHeader, width, headerHeight);

      const totalTextHeight = linhas.length * lineHeight;
      const startY = yHeader + (headerHeight - totalTextHeight) / 2 + 8;

      linhas.forEach((linha, idx) => {
        doc.text(linha, currentX + width / 2, startY + idx * lineHeight, {
          align: "center"
        });
      });

      currentX += width;
    });

    return yHeader + headerHeight;
  };

  const drawTitleAndHeader = (yStart) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(titulo, x, yStart);

    let yLocal = yStart + gapTituloCabecalho;
    yLocal = drawTableHeader(yLocal);
    return yLocal;
  };

  y = garantirEspacoPagina(doc, y, 18 + gapTituloCabecalho + getHeaderHeight(), margem, pageHeight);
  y = drawTitleAndHeader(y);

  rows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let maxLines = 1;

    const rowLineCache = columns.map((col, i) => {
      const raw = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "";
      const valor = limparTextoPDF(raw);
      const align = col.align || "left";
      const linhas = getCellBlock(valor, colWidths[i], align);

      if (linhas.length > maxLines) maxLines = linhas.length;
      return linhas;
    });

    const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 12);

    y = garantirEspacoPagina(
      doc,
      y,
      rowHeight,
      margem,
      pageHeight,
      (novoY) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setLineWidth(borderWidth);
        return drawTitleAndHeader(novoY);
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setLineWidth(borderWidth);

    let currentX = x;

    columns.forEach((col, i) => {
      const width = colWidths[i];
      const align = col.align || "left";
      const linhas = rowLineCache[i];

      doc.rect(currentX, y, width, rowHeight);

      const totalTextHeight = linhas.length * lineHeight;
      const startY = y + (rowHeight - totalTextHeight) / 2 + 8;

      if (align === "center") {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + width / 2, startY + idx * lineHeight, {
            align: "center"
          });
        });
      } else if (align === "right") {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + width - cellPaddingX, startY + idx * lineHeight, {
            align: "right"
          });
        });
      } else {
        linhas.forEach((linha, idx) => {
          doc.text(linha, currentX + cellPaddingX, startY + idx * lineHeight);
        });
      }

      currentX += width;
    });

    y += rowHeight;
  });

  return y + gapDepoisTabela;
}

async function _baixarAnalisePDFInterno() {
  const svg = obterSVGPronto();
  if (!svg) { mostrarToast("Gere o fluxo primeiro.", "alerta"); return; }

  const infoLinhas = extrairLinhasInfoProcesso();
  const dados = coletarDadosAnaliseEstruturados();

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margem = 40;
  const larguraUtil = pageWidth - margem * 2;

  let y = margem;

  const processoNome = obterValorCampo("processo") || "Fluxograma do Processo";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = adicionarTextoQuebrado(doc, processoNome, margem, y, larguraUtil, 18);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  y = garantirEspacoPagina(doc, y, 24, margem, pageHeight);
  doc.text("Informações do Processo", margem, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  infoLinhas.forEach((linha) => {
    y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
    y = adicionarTextoQuebrado(doc, linha, margem, y, larguraUtil, 13);
  });

  y += 14;

  const svgWidth = Number(svg.getAttribute("width")) || 1200;
  const svgHeight = Number(svg.getAttribute("height")) || 800;

  const escala = Math.min(larguraUtil / svgWidth, 1);
  const larguraSvgPdf = svgWidth * escala;
  const alturaSvgPdf = svgHeight * escala;

  y = garantirEspacoPagina(doc, y, alturaSvgPdf + 20, margem, pageHeight);

  await doc.svg(svg, {
    x: margem + (larguraUtil - larguraSvgPdf) / 2,
    y,
    width: larguraSvgPdf,
    height: alturaSvgPdf
  });

  y += alturaSvgPdf + 24;
  y = garantirEspacoPagina(doc, y, 28, margem, pageHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Análise do Processo", margem, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(`Tempo total do processo: ${formatarTempo(dados.tempoTotal)}`, margem, y);
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(`Loops detectados: ${dados.loops}`, margem, y);
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(
    `Potencial retrabalho: ${formatarTempo(dados.tempoPotencialRetrabalho)} | ${formatarPercentual(dados.impactoPotencialRetrabalho)}%`,
    margem,
    y
  );
  y += 18;

  y = garantirEspacoPagina(doc, y, 18, margem, pageHeight);
  doc.text(
    `Taxa de decisão: ${dados.decisoes} etapa(s) | ${formatarPercentual(dados.taxaDecisao)}%`,
    margem,
    y
  );
  y += 6;

  y = desenharTabelaPDF(doc, {
    titulo: "Top 3 Gargalos",
    columns: [
      { header: "Atividade", key: "atividade", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.top3Gargalos.map(item => ({
      atividade: item.atividade,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Tempo por Tipo",
    columns: [
      { header: "Tipo", key: "tipo", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.tempoPorTipo.map(item => ({
      tipo: item.tipo,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Tempo por Sistema",
    columns: [
      { header: "Sistema", key: "sistema", weight: 5.5, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.6, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.2, align: "center" }
    ],
    rows: dados.tempoPorSistema.map(item => ({
      sistema: item.sistema,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  y = desenharTabelaPDF(doc, {
    titulo: "Pareto de Tempo",
    columns: [
      { header: "Atividade", key: "atividade", weight: 5.4, align: "left" },
      { header: "Tempo (horas)", key: "tempoFmt", weight: 1.5, align: "center" },
      { header: "%", key: "percentualFmt", weight: 1.0, align: "center" },
      { header: "Pareto", key: "paretoFmt", weight: 1.3, align: "center" }
    ],
    rows: dados.pareto.map(item => ({
      atividade: item.atividade,
      tempoFmt: formatarTempo(item.tempo),
      percentualFmt: `${formatarPercentual(item.percentual)}%`,
      paretoFmt: `${formatarPercentual(item.pareto)}%`
    })),
    x: margem,
    yInicial: y,
    larguraTotal: larguraUtil,
    margem,
    pageHeight
  });

  doc.save(`${ultimoNomeArquivo}_analise.pdf`);
}

function baixarSVG() {
  const svg = obterSVGPronto();
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${ultimoNomeArquivo}.svg`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _baixarSVGExcelInterno() {
  const svg = gerarFluxoExcel();
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${gerarNomeArquivo()}_excel.svg`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixarFluxo() {
  baixarSVG();
}

/* Wrappers com overlay "Gerando..." para exports pesados (Onda 1) */
async function baixarAnalisePDF() {
  await executarComProcessando("Gerando PDF da análise...", () => _baixarAnalisePDFInterno());
}

function baixarSVGExcel() {
  executarComProcessando("Gerando SVG para Excel...", () => _baixarSVGExcelInterno());
}

function atualizarBarraRolagemSuperior() {
  const wrap = document.getElementById("diagramWrap");
  const topScroll = document.getElementById("diagramScrollTop");
  const topInner = document.getElementById("diagramScrollTopInner");
  const diagram = document.getElementById("diagram");

  if (!wrap || !topScroll || !topInner || !diagram) return;

  topInner.style.width = diagram.scrollWidth + "px";

  topScroll.onscroll = () => {
    wrap.scrollLeft = topScroll.scrollLeft;
  };

  wrap.onscroll = () => {
    topScroll.scrollLeft = wrap.scrollLeft;
  };
}

function inicializarAplicacao() {
  configurarAutoSaveCamposFixos();

  const restaurou = restaurarEstadoLocal();

  atualizarTabela();
  configurarNavegacaoTabTabela();
  renderizarDatalists();

  if (!restaurou && !fluxoData.length) {
    adicionarLinha();
  }

  if (restaurou && !fluxoData.length) {
    adicionarLinha();
  }
}

window.addEventListener("scroll", fecharAutocomplete, true);
window.addEventListener("resize", fecharAutocomplete);

document.addEventListener("click", (event) => {
  const clicouNoInputAutocomplete = event.target.closest(
    'input[data-campo="area"], input[data-campo="tipo"], input[data-campo="sistema"], .autocomplete-box'
  );

  if (!clicouNoInputAutocomplete) {
    fecharAutocomplete();
  }
});

window.addEventListener("beforeunload", () => {
  salvarEstadoLocal(true);
});

window.addEventListener("DOMContentLoaded", inicializarAplicacao);
/* =====================================================================
   ONDA 1 — Feedback (toast/overlay), Decisão, PNG e Projeto JSON
   Bloco aditivo: não altera o motor de roteamento nem a geração do SVG.
===================================================================== */

/* ---------- Toast (substitui os alerts) ---------- */
function garantirToastContainer() {
  let c = document.getElementById("toastContainer");
  if (!c) {
    c = document.createElement("div");
    c.id = "toastContainer";
    document.body.appendChild(c);
  }
  return c;
}

function mostrarToast(mensagem, tipo = "info", duracaoMs = 3200) {
  const container = garantirToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  toast.style.pointerEvents = "auto";
  container.appendChild(toast);

  // força reflow para ativar a transição
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, duracaoMs);
}

/* ---------- Overlay "Gerando..." para exports pesados ---------- */
function garantirProcessandoOverlay() {
  let o = document.getElementById("processandoOverlay");
  if (!o) {
    o = document.createElement("div");
    o.id = "processandoOverlay";
    o.innerHTML = `
      <div class="processando-box">
        <div class="processando-spinner"></div>
        <span id="processandoTexto">Gerando...</span>
      </div>`;
    document.body.appendChild(o);
  }
  return o;
}

function mostrarProcessando(texto = "Gerando...") {
  const o = garantirProcessandoOverlay();
  const t = document.getElementById("processandoTexto");
  if (t) t.textContent = texto;
  o.classList.add("show");
}

function esconderProcessando() {
  const o = document.getElementById("processandoOverlay");
  if (o) o.classList.remove("show");
}

/**
 * Executa uma tarefa (sync ou async) com overlay de processamento.
 * Usa duplo requestAnimationFrame para garantir que o overlay pinte
 * antes de iniciar trabalho pesado e síncrono.
 */
function executarComProcessando(texto, tarefa) {
  mostrarProcessando(texto);
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          const r = await tarefa();
          resolve(r);
        } catch (erro) {
          console.error(erro);
          mostrarToast("Erro ao gerar o arquivo. Veja o console para detalhes.", "erro");
          reject(erro);
        } finally {
          esconderProcessando();
        }
      });
    });
  });
}

/* ---------- Decisão: tipo "Decisão" OU texto terminado em "?" ---------- */
function ehDecisao(etapa) {
  if (!etapa) return false;
  if (isPergunta(etapa.atividade || "")) return true;
  const tipo = normalizarEspacos(etapa.tipo || "").toLocaleLowerCase("pt-BR");
  return tipo === "decisão" || tipo === "decisao";
}

/* ---------- Exportar PNG (mantém SVG e PDF intactos) ---------- */
function baixarPNG() {
  const svg = obterSVGPronto();
  if (!svg) {
    mostrarToast("Gere o fluxo primeiro.", "alerta");
    return;
  }

  executarComProcessando("Gerando PNG...", () => new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svg);
      const svg64 = "data:image/svg+xml;base64," +
        window.btoa(unescape(encodeURIComponent(source)));

      const largura = Number(svg.getAttribute("width")) || 1200;
      const altura = Number(svg.getAttribute("height")) || 800;
      const escala = 2; // 2x para boa nitidez ao colar em slides/e-mail

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = largura * escala;
        canvas.height = altura * escala;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Falha ao gerar PNG")); return; }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${ultimoNomeArquivo}.png`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          mostrarToast("PNG gerado com sucesso.", "ok");
          resolve();
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Falha ao carregar SVG para PNG"));
      img.src = svg64;
    } catch (erro) {
      reject(erro);
    }
  }));
}

/* ---------- Exportar projeto (.json) ---------- */
const PROJETO_VERSAO = 1;

function exportarProjetoJSON() {
  if (!fluxoData || !fluxoData.length) {
    mostrarToast("Não há nada para exportar. Monte o fluxo primeiro.", "alerta");
    return;
  }

  const estado = obterEstadoAtual();

  const projeto = {
    app: "gerador_fluxograma",
    versao: PROJETO_VERSAO,
    exportadoEm: new Date().toISOString(),
    estado,
    // Reservado para a Onda 2 (editor de conexões/raias).
    // Mantido aqui desde já para preservar compatibilidade.
    overridesConexoes: (typeof overridesConexoes !== "undefined") ? overridesConexoes : {},
    ordemRaias: (typeof ordemRaias !== "undefined") ? ordemRaias : []
  };

  const nomeBase = gerarNomeArquivo ? gerarNomeArquivo() : (ultimoNomeArquivo || "fluxograma_processo");
  const blob = new Blob([JSON.stringify(projeto, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeBase}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  mostrarToast("Projeto exportado. Guarde o arquivo .json para reabrir depois.", "ok");
}

/* ---------- Importar projeto (.json) ---------- */
function importarProjetoJSON(event) {
  const input = event && event.target ? event.target : null;
  const file = input && input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const projeto = JSON.parse(reader.result);

      if (!projeto || typeof projeto !== "object" || !projeto.estado) {
        mostrarToast("Arquivo inválido: não parece um projeto exportado por esta ferramenta.", "erro");
        return;
      }

      // Reaproveita o pipeline de restauração existente:
      // grava o estado no storage e restaura por ele.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projeto.estado));
      const ok = restaurarEstadoLocal();

      // Carrega overrides reservados, se já existirem nesta versão do app.
      if (typeof overridesConexoes !== "undefined" && projeto.overridesConexoes) {
        overridesConexoes = projeto.overridesConexoes;
      }
      if (typeof ordemRaias !== "undefined" && Array.isArray(projeto.ordemRaias)) {
        ordemRaias = projeto.ordemRaias;
      }

      atualizarTabela();
      renderizarDatalists();
      salvarEstadoLocal(true);

      if (ok) {
        mostrarToast("Projeto importado. Clique em GERAR FLUXO para visualizar.", "ok");
      } else {
        mostrarToast("Projeto carregado, mas houve inconsistências ao restaurar.", "alerta");
      }
    } catch (erro) {
      console.error("Erro ao importar projeto:", erro);
      mostrarToast("Não foi possível ler o arquivo. Verifique se é um .json válido.", "erro");
    } finally {
      if (input) input.value = ""; // permite reimportar o mesmo arquivo
    }
  };

  reader.onerror = () => mostrarToast("Falha ao ler o arquivo.", "erro");
  reader.readAsText(file);
}

/* =====================================================================
   ONDA 2 — Editor interativo de conexões e raias
   - Ajuste de lados (saída/entrada) por conexão, via popover
   - Reordenação de raias via painel com setas ↑/↓
   - Tudo persiste no projeto (.json) e não vaza no SVG exportado
===================================================================== */

const LADOS = [
  { lado: "top", icone: "▲", nome: "Cima" },
  { lado: "right", icone: "▶", nome: "Direita" },
  { lado: "bottom", icone: "▼", nome: "Baixo" },
  { lado: "left", icone: "◀", nome: "Esquerda" }
];

function chaveOverride(origemId, destinoId) {
  return `${origemId}__${destinoId}`;
}

function obterOverrideConexao(origemId, destinoId) {
  if (!overridesConexoes) return null;
  return overridesConexoes[chaveOverride(origemId, destinoId)] || null;
}

/* ---------- Toggle do modo de edição ---------- */
function alternarModoEdicao() {
  if (!document.querySelector("#diagram svg")) {
    gerarFluxo();
    if (!document.querySelector("#diagram svg")) {
      mostrarToast("Gere o fluxo primeiro.", "alerta");
      return;
    }
  }

  modoEdicaoAtivo = !modoEdicaoAtivo;
  const btn = document.getElementById("btnAjustarFluxo");

  if (modoEdicaoAtivo) {
    if (btn) { btn.classList.add("ativo"); btn.textContent = "Concluir ajustes"; }
    aplicarCamadaEdicao();
    renderPainelRaias();
    mostrarToast("Modo de ajuste ativo: clique numa seta para corrigir entrada/saída.", "info", 4500);
  } else {
    if (btn) { btn.classList.remove("ativo"); btn.textContent = "Ajustar fluxo"; }
    removerCamadaEdicao();
    fecharPopoverConexao();
    mostrarToast("Ajustes concluídos.", "ok");
  }
}

/* ---------- Camada clicável sobre as setas ---------- */
function aplicarCamadaEdicao() {
  const svg = document.querySelector("#diagram svg");
  if (!svg) return;

  // remove camada anterior, se houver
  const antiga = svg.querySelector("g.editor-ui");
  if (antiga) antiga.remove();

  const g = criarElementoSVG("g");
  g.setAttribute("class", "editor-ui");

  svg.querySelectorAll("path.conexao-fluxo").forEach((p) => {
    const origemId = p.getAttribute("data-origem");
    const destinoId = p.getAttribute("data-destino");

    // destaque da conexão selecionada
    if (
      conexaoSelecionada &&
      conexaoSelecionada.origemId === origemId &&
      conexaoSelecionada.destinoId === destinoId
    ) {
      p.setAttribute("stroke", "#1d6fe0");
      p.setAttribute("stroke-width", CONFIG.lineWidth + 1.4);
    } else {
      p.setAttribute("stroke", "#111111");
      p.setAttribute("stroke-width", CONFIG.lineWidth);
    }

    // área de clique mais larga (transparente) por cima da seta
    const hit = criarElementoSVG("path");
    hit.setAttribute("d", p.getAttribute("d"));
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "rgba(0,0,0,0.001)");
    hit.setAttribute("stroke-width", "16");
    hit.setAttribute("stroke-linecap", "round");
    hit.setAttribute("style", "cursor:pointer");
    hit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      abrirPopoverConexao(origemId, destinoId, ev.clientX, ev.clientY);
    });
    g.appendChild(hit);
  });

  svg.appendChild(g);
}

function removerCamadaEdicao() {
  const svg = document.querySelector("#diagram svg");
  if (svg) {
    const g = svg.querySelector("g.editor-ui");
    if (g) g.remove();
    // restaura aparência padrão das conexões
    svg.querySelectorAll("path.conexao-fluxo").forEach((p) => {
      p.setAttribute("stroke", "#111111");
      p.setAttribute("stroke-width", CONFIG.lineWidth);
    });
  }
  const painel = document.getElementById("painelRaias");
  if (painel) painel.remove();
  conexaoSelecionada = null;
}

/* ---------- Popover de ajuste de uma conexão ---------- */
let popoverPos = { x: 0, y: 0 };

function abrirPopoverConexao(origemId, destinoId, x, y) {
  conexaoSelecionada = { origemId, destinoId };
  popoverPos = { x, y };
  renderPopoverConexao();
  aplicarCamadaEdicao(); // reforça o destaque da selecionada
}

function rotuloNo(id) {
  if (id === "__INICIO__") return "Início";
  if (id === "__FIM__") return "Fim";
  return id;
}

function renderPopoverConexao() {
  if (!conexaoSelecionada) return;

  let pop = document.getElementById("popoverConexao");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "popoverConexao";
    document.body.appendChild(pop);
  }

  const { origemId, destinoId } = conexaoSelecionada;
  const override = obterOverrideConexao(origemId, destinoId) || {};

  const botoesLado = (qual, ativo) =>
    LADOS.map(l => {
      const sel = ativo === l.lado ? " sel" : "";
      return `<button type="button" class="lado-btn${sel}" title="${l.nome}"
        onclick="definirLadoConexao('${qual}','${l.lado}')">${l.icone}</button>`;
    }).join("");

  pop.innerHTML = `
    <div class="pop-header">
      <span>Conexão <b>${rotuloNo(origemId)} → ${rotuloNo(destinoId)}</b></span>
      <button type="button" class="pop-fechar" onclick="fecharPopoverConexao()">✕</button>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Saída de ${rotuloNo(origemId)}</div>
      <div class="pop-botoes">${botoesLado("start", override.startSide)}</div>
    </div>
    <div class="pop-grupo">
      <div class="pop-label">Entrada em ${rotuloNo(destinoId)}</div>
      <div class="pop-botoes">${botoesLado("end", override.endSide)}</div>
    </div>
    <div class="pop-rodape">
      <button type="button" class="pop-auto" onclick="resetarConexaoAtual()">Voltar ao automático</button>
    </div>
  `;

  // posiciona dentro da viewport
  pop.style.display = "block";
  const margem = 10;
  const larg = pop.offsetWidth || 240;
  const alt = pop.offsetHeight || 200;
  let px = popoverPos.x + 12;
  let py = popoverPos.y + 12;
  if (px + larg + margem > window.innerWidth) px = window.innerWidth - larg - margem;
  if (py + alt + margem > window.innerHeight) py = window.innerHeight - alt - margem;
  pop.style.left = Math.max(margem, px) + "px";
  pop.style.top = Math.max(margem, py) + "px";
}

function fecharPopoverConexao() {
  const pop = document.getElementById("popoverConexao");
  if (pop) pop.style.display = "none";
  conexaoSelecionada = null;
  if (modoEdicaoAtivo) aplicarCamadaEdicao();
}

function definirLadoConexao(qual, lado) {
  if (!conexaoSelecionada) return;
  const { origemId, destinoId } = conexaoSelecionada;
  const chave = chaveOverride(origemId, destinoId);
  const atual = overridesConexoes[chave] ? { ...overridesConexoes[chave] } : {};

  if (qual === "start") {
    atual.startSide = lado;
    if (!atual.endSide) atual.endSide = "left"; // completa para a rota ter efeito imediato
  } else {
    atual.endSide = lado;
    if (!atual.startSide) atual.startSide = "right";
  }

  overridesConexoes[chave] = atual;
  salvarEstadoLocal(true);
  gerarFluxo();          // re-renderiza respeitando o override
  renderPopoverConexao();// reflete a seleção atual nos botões
}

function resetarConexaoAtual() {
  if (!conexaoSelecionada) return;
  const chave = chaveOverride(conexaoSelecionada.origemId, conexaoSelecionada.destinoId);
  delete overridesConexoes[chave];
  salvarEstadoLocal(true);
  gerarFluxo();
  renderPopoverConexao();
  mostrarToast("Conexão voltou ao roteamento automático.", "ok");
}

/* ---------- Painel de ordenação das raias ---------- */
function renderPainelRaias() {
  let painel = document.getElementById("painelRaias");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelRaias";
    const ref = document.getElementById("diagramScrollTop");
    if (ref && ref.parentNode) {
      ref.parentNode.insertBefore(painel, ref);
    } else {
      const wrap = document.getElementById("diagramWrap");
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(painel, wrap);
    }
  }

  const areas = (ultimasAreasOrdenadas && ultimasAreasOrdenadas.length)
    ? ultimasAreasOrdenadas
    : [];

  if (!areas.length) {
    painel.innerHTML = "";
    return;
  }

  const itens = areas.map((nome, i) => `
    <div class="raia-item">
      <span class="raia-pos">${i + 1}º</span>
      <span class="raia-nome" title="${escaparHTML(nome)}">${escaparHTML(nome)}</span>
      <span class="raia-acoes">
        <button type="button" ${i === 0 ? "disabled" : ""} onclick="moverRaia('${escaparHTML(nome).replace(/'/g, "\\'")}', -1)" title="Subir">↑</button>
        <button type="button" ${i === areas.length - 1 ? "disabled" : ""} onclick="moverRaia('${escaparHTML(nome).replace(/'/g, "\\'")}', 1)" title="Descer">↓</button>
      </span>
    </div>`).join("");

  painel.innerHTML = `
    <div class="raias-header">
      <span>Ordem das raias</span>
      <button type="button" class="raias-reset" onclick="resetarAjustesFluxo()">Resetar ajustes</button>
    </div>
    <div class="raias-lista">${itens}</div>
    <div class="raias-dica">Clique numa seta do fluxo para corrigir sua entrada/saída.</div>
  `;
}

function moverRaia(nome, direcao) {
  let base = (ordemRaias && ordemRaias.length) ? [...ordemRaias] : [...ultimasAreasOrdenadas];
  // garante que todas as raias atuais estão na base e remove as que sumiram
  ultimasAreasOrdenadas.forEach(a => { if (!base.includes(a)) base.push(a); });
  base = base.filter(a => ultimasAreasOrdenadas.includes(a));

  const i = base.indexOf(nome);
  const j = i + direcao;
  if (i === -1 || j < 0 || j >= base.length) return;

  [base[i], base[j]] = [base[j], base[i]];
  ordemRaias = base;
  salvarEstadoLocal(true);
  gerarFluxo(); // re-render reaplica camada e painel
}

function resetarAjustesFluxo() {
  const temAjustes =
    (overridesConexoes && Object.keys(overridesConexoes).length) ||
    (ordemRaias && ordemRaias.length);

  if (!temAjustes) {
    mostrarToast("Não há ajustes manuais para resetar.", "info");
    return;
  }

  if (!confirm("Remover todos os ajustes manuais de setas e ordem de raias?")) return;

  overridesConexoes = {};
  ordemRaias = [];
  conexaoSelecionada = null;
  salvarEstadoLocal(true);
  gerarFluxo();
  fecharPopoverConexao();
  mostrarToast("Ajustes manuais removidos. Fluxo voltou ao automático.", "ok");
}

/* Fecha o popover ao clicar fora dele (e fora das setas) */
document.addEventListener("click", (event) => {
  const pop = document.getElementById("popoverConexao");
  if (!pop || pop.style.display === "none") return;
  if (event.target.closest("#popoverConexao")) return;
  if (event.target.closest("g.editor-ui")) return;
  fecharPopoverConexao();
});
