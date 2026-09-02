/* =========================================================
   03-utils.js  |  Gerador de Fluxograma
   Helpers puros: HTML, cor, tempo, formatação, medição/quebra de texto
   (linhas 1615-1821 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
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

/* Fallback pra formato natural de duração ("30min", "2h", "2h30min",
   "1 dia"...) — usado só quando o texto NÃO é um número puro nem H:M:S (ver
   tempoParaSegundos). A IA às vezes ainda escreve assim mesmo com o prompt
   pedindo H:MM:SS explicitamente, e digitar direto na ferramenta (tabela ou
   popover "Mover caixa") também deve funcionar, não só o formato oficial.
   Tudo em horas, nunca dia — "1 dia" = 24h corridas (mesma convenção do
   prompt da IA: 2 dias = 48h, 10 dias = 240h). Retorna null (não 0) quando
   não reconhece nada, pra tempoParaSegundos distinguir "não achei nenhuma
   unidade" de "achei e dava zero". */
function tempoNaturalParaSegundos(texto) {
  const t = " " + String(texto).toLowerCase().replace(",", ".") + " ";
  let total = 0;
  let achou = false;

  const dias = t.match(/(\d+(?:\.\d+)?)\s*d(?:ia|ias)?\b/);
  if (dias) { total += parseFloat(dias[1]) * 24 * 3600; achou = true; }

  const horas = t.match(/(\d+(?:\.\d+)?)\s*h(?:oras?)?\b/);
  if (horas) { total += parseFloat(horas[1]) * 3600; achou = true; }

  const minutos = t.match(/(\d+(?:\.\d+)?)\s*min(?:utos?)?\b/);
  if (minutos) { total += parseFloat(minutos[1]) * 60; achou = true; }

  return achou ? Math.round(total) : null;
}

function tempoParaSegundos(tempo) {
  if (!tempo) return 0;
  tempo = String(tempo).trim();

  if (!tempo.includes(":")) {
    // Número puro (sem unidade) = horas — comportamento original, intocado.
    const comoNumero = Number(tempo.replace(",", "."));
    if (!isNaN(comoNumero)) {
      return comoNumero * 3600;
    }

    // Não é número puro: tenta o formato natural antes de desistir e zerar.
    const natural = tempoNaturalParaSegundos(tempo);
    return natural !== null ? natural : 0;
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

