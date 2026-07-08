/* =========================================================
   01-estado.js  |  Gerador de Fluxograma
   Estado global, persistência local e auto-save dos campos fixos
   (linhas 1-220 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
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
let ultimasPosicoesNos = null;  // mapa de posições do último render (para "mover caixa")
let filtroAnaliseArea = "";  // filtro de raia da Análise ("" = Todos)
let conexaoSelecionada = null;// { origemId, destinoId } em edição
let ultimasAreasOrdenadas = [];// snapshot das raias do último render (para o painel)

/* ===== Estado do editor — rótulos, terminais Início/Fim (Onda 2.2) ===== */
let rotulosConexoes = {};     // chave "origemId__destinoId" -> "Sim" | "Não" | ""
let terminais = [];           // [{ id, tipo:'inicio'|'fim', alvo: idVisual }]
let inicioAlvo = "";          // idVisual da caixa onde o Início padrão conecta ("" = primeira)
let fimOrigem = "";           // idVisual da caixa de onde o Fim padrão vem ("" = última)
let inicioOculto = false;     // esconde o Início padrão e sua seta
let terminalCounter = 1;

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
      valorFTE: obterValorCampo("valorFTE"),
      volumetria: obterValorCampo("volumetria"),
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
          extras: Array.isArray(item.extras) ? [...item.extras] : [],
          semSaida: !!item.semSaida,
          simRemovido: !!item.simRemovido
        }))
      : [],
    uidCounter: Number(uidCounter) || 1,
    ultimoNomeArquivo: ultimoNomeArquivo || "fluxograma_processo",
    overridesConexoes: overridesConexoes && typeof overridesConexoes === "object" ? overridesConexoes : {},
    ordemRaias: Array.isArray(ordemRaias) ? [...ordemRaias] : [],
    rotulosConexoes: rotulosConexoes && typeof rotulosConexoes === "object" ? rotulosConexoes : {},
    terminais: Array.isArray(terminais) ? [...terminais] : [],
    inicioAlvo: inicioAlvo || "",
    fimOrigem: fimOrigem || "",
    inicioOculto: !!inicioOculto
  };
}

function salvarEstadoLocal(imediato = false) {
  const executar = () => {
    try {
      const estado = obterEstadoAtual();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
      // B1 (undo/redo): gancho opcional. No-op se 13-undo.js não estiver carregado.
      if (typeof historicoAoSalvar === "function") historicoAoSalvar(estado);
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
    preencherCampoSeExistir("valorFTE", topo.valorFTE || "");
    preencherCampoSeExistir("volumetria", topo.volumetria || "");
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
          extras: Array.isArray(item.extras) ? [...item.extras] : [],
          semSaida: !!item.semSaida,
          simRemovido: !!item.simRemovido
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
    rotulosConexoes =
      estado.rotulosConexoes && typeof estado.rotulosConexoes === "object"
        ? estado.rotulosConexoes
        : {};
    terminais = Array.isArray(estado.terminais) ? estado.terminais : [];
    inicioAlvo = estado.inicioAlvo || "";
    fimOrigem = estado.fimOrigem || "";
    inicioOculto = !!estado.inicioOculto;
    terminalCounter = (terminais.reduce((m, t) => {
      const n = parseInt(String(t.id).replace(/\D/g, ""), 10) || 0;
      return Math.max(m, n);
    }, 0)) + 1;

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

