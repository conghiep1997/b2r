/**
 * Markdown / Textile preview rendering for the extension modal.
 * - renderMarkdownHtml: edit-time Markdown preview (legacy)
 * - renderRedmineNotePreview: closest-to-Redmine preview (MD → Textile → HTML)
 */

/* global markdownToTextile */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isSafeMarkdownHref(href) {
  const trimmedHref = String(href || "").trim();
  return /^(https?:|mailto:|#|\/(?!\/))/i.test(trimmedHref);
}

/** Decode then re-escape so already-escaped Textile <pre>/<code> bodies stay single-encoded. */
function normalizeEscapedHtml(value) {
  const decoded = String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return escapeHtml(decoded);
}

function renderInlineMarkdown(text) {
  const codeTokens = [];
  let html = text.replace(/`([^`]+?)`/g, (_match, code) => {
    const token = `@@TB_CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      if (!isSafeMarkdownHref(href)) {
        return label;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  codeTokens.forEach((value, index) => {
    html = html.replace(`@@TB_CODE_${index}@@`, value);
  });

  return html;
}

function flushParagraph(blocks, paragraphLines) {
  if (!paragraphLines.length) return;
  blocks.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`);
  paragraphLines.length = 0;
}

function flushList(blocks, listState) {
  if (!listState.items.length) return;

  const tag = listState.type === "ol" ? "ol" : "ul";
  const className = listState.hasTasks ? ' class="tb-task-list"' : "";
  blocks.push(`<${tag}${className}>${listState.items.join("")}</${tag}>`);
  listState.items = [];
  listState.type = "ul";
  listState.hasTasks = false;
}

function flushBlockquote(blocks, quoteLines) {
  if (!quoteLines.length) return;
  blocks.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join("<br>")}</blockquote>`);
  quoteLines.length = 0;
}

function flushOpenBlocks(blocks, paragraphLines, listState, quoteLines) {
  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listState);
  flushBlockquote(blocks, quoteLines);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableRow(line) {
  return line.includes("|") && !/^\s*\|?\s*$/.test(line);
}

function splitTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(tableLines) {
  const [headerLine, _separatorLine, ...rowLines] = tableLines;
  const headers = splitTableCells(headerLine);
  const rows = rowLines.map(splitTableCells);

  const thead = `<thead><tr>${headers
    .map((header) => `<th>${renderInlineMarkdown(header)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows
        .map(
          (row) =>
            `<tr>${headers
              .map((_header, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody>`
    : "";

  return `<div class="tb-preview-table-wrap"><table>${thead}${tbody}</table></div>`;
}

function collectTable(lines, startIndex) {
  if (!isTableRow(lines[startIndex]) || !isTableSeparator(lines[startIndex + 1] || "")) {
    return null;
  }

  const tableLines = [lines[startIndex], lines[startIndex + 1]];
  let nextIndex = startIndex + 2;
  while (nextIndex < lines.length && isTableRow(lines[nextIndex])) {
    tableLines.push(lines[nextIndex]);
    nextIndex++;
  }

  return { html: renderTable(tableLines), nextIndex };
}

function renderTaskListItem(content, checkedMarker) {
  const checked = /^x$/i.test(checkedMarker) ? " checked" : "";
  return `<li class="tb-task-list-item"><input type="checkbox" disabled${checked}> <span>${renderInlineMarkdown(content)}</span></li>`;
}

/**
 * Renders markdown text as HTML.
 * @param {string} text - Markdown text to render
 * @returns {string} - HTML string
 */
function renderMarkdownHtml(text) {
  const lines = escapeHtml(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const paragraphLines = [];
  const quoteLines = [];
  const listState = { type: "ul", items: [], hasTasks: false };
  let codeLines = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (/^```/.test(trimmedLine)) {
      if (codeLines) {
        blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
        codeLines = null;
      } else {
        flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    if (!trimmedLine) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      continue;
    }

    const table = collectTable(lines, index);
    if (table) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^&gt;\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (taskMatch || unorderedMatch || orderedMatch) {
      flushParagraph(blocks, paragraphLines);
      flushBlockquote(blocks, quoteLines);

      const nextType = orderedMatch ? "ol" : "ul";
      if (listState.items.length && listState.type !== nextType) {
        flushList(blocks, listState);
      }

      listState.type = nextType;
      if (taskMatch) {
        listState.hasTasks = true;
        listState.items.push(renderTaskListItem(taskMatch[2], taskMatch[1]));
      } else {
        listState.items.push(
          `<li>${renderInlineMarkdown((unorderedMatch || orderedMatch)[1])}</li>`
        );
      }
      continue;
    }

    flushList(blocks, listState);
    flushBlockquote(blocks, quoteLines);
    paragraphLines.push(line);
  }

  if (codeLines) {
    blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  }
  flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);

  return blocks.join("");
}

function renderInlineTextile(escapedText) {
  const tokens = [];
  const protect = (html) => {
    const token = `@@TB_TINL${tokens.length}@@`;
    tokens.push(html);
    return token;
  };

  let html = String(escapedText || "");

  // "label":url  (quotes were escaped)
  html = html.replace(/&quot;([^&]+?)&quot;:(https?:\/\/[^\s<]+)/gi, (_m, label, href) => {
    if (!isSafeMarkdownHref(href)) {
      return label;
    }
    return protect(`<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  });

  // Images / attachments !file! — protect before strike/bold so class names stay intact
  html = html.replace(/!([^!\s<]+)!/g, (_m, name) =>
    protect(`<span class="tb-redmine-attachment">${name}</span>`)
  );

  // Bold / italic / strike (Textile) — avoid matching inside words/hyphenated tokens
  html = html.replace(/(?<![\w*])\*(.+?)\*(?![\w*])/g, "<strong>$1</strong>");
  html = html.replace(/(?<![\w_])_(.+?)_(?![\w_])/g, "<em>$1</em>");
  html = html.replace(/(?<![\w-])-(.+?)-(?![\w-])/g, "<del>$1</del>");

  tokens.forEach((value, index) => {
    html = html.split(`@@TB_TINL${index}@@`).join(value);
  });

  return html;
}

function flushTextileParagraph(blocks, lines) {
  if (!lines.length) return;
  blocks.push(`<p>${lines.map(renderInlineTextile).join("<br>")}</p>`);
  lines.length = 0;
}

function flushTextileList(blocks, listState) {
  if (!listState.items.length) return;
  const tag = listState.type === "ol" ? "ol" : "ul";
  const className = listState.hasTasks ? ' class="tb-task-list"' : "";
  blocks.push(`<${tag}${className}>${listState.items.join("")}</${tag}>`);
  listState.items = [];
  listState.type = "ul";
  listState.hasTasks = false;
}

function flushTextileQuote(blocks, quoteLines) {
  if (!quoteLines.length) return;
  blocks.push(`<blockquote>${quoteLines.map(renderInlineTextile).join("<br>")}</blockquote>`);
  quoteLines.length = 0;
}

/**
 * Approximate Redmine Textile wiki rendering for preview.
 * @param {string} textile
 * @returns {string}
 */
function renderTextileHtml(textile) {
  const protections = [];
  const protect = (html) => {
    const token = `@@TB_TPROT${protections.length}@@`;
    protections.push(html);
    return token;
  };

  let text = String(textile || "").replace(/\r\n?/g, "\n");

  // Collapse macros → details (render inner recursively)
  text = text.replace(/\{\{collapse\(([^)]*)\)\n?([\s\S]*?)\}\}/gi, (_m, title, body) =>
    protect(
      `<details class="tb-redmine-collapse"><summary>${escapeHtml(
        title
      )}</summary><div class="tb-redmine-collapse-body">${renderTextileHtml(
        body.trim()
      )}</div></details>`
    )
  );

  // Safe HTML fragments produced by markdownToTextile (body already entity-escaped)
  text = text.replace(/<pre>\n?([\s\S]*?)\n?<\/pre>/gi, (_m, body) =>
    protect(`<pre><code>${normalizeEscapedHtml(body)}</code></pre>`)
  );
  text = text.replace(/<code>([\s\S]*?)<\/code>/gi, (_m, body) =>
    protect(`<code>${normalizeEscapedHtml(body)}</code>`)
  );
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, (_m, body) => protect(`<u>${escapeHtml(body)}</u>`));
  text = text.replace(/<mark>([\s\S]*?)<\/mark>/gi, (_m, body) =>
    protect(`<mark>${escapeHtml(body)}</mark>`)
  );
  text = text.replace(/<kbd>([\s\S]*?)<\/kbd>/gi, (_m, body) =>
    protect(`<kbd>${escapeHtml(body)}</kbd>`)
  );
  text = text.replace(/<sup>([\s\S]*?)<\/sup>/gi, (_m, body) =>
    protect(`<sup>${escapeHtml(body)}</sup>`)
  );
  text = text.replace(/<sub>([\s\S]*?)<\/sub>/gi, (_m, body) =>
    protect(`<sub>${escapeHtml(body)}</sub>`)
  );
  text = text.replace(/<span\s+style="([^"]*)">([\s\S]*?)<\/span>/gi, (_m, style, body) => {
    const safeStyle = String(style).replace(/[<>'"`]/g, "");
    return protect(`<span style="${escapeHtml(safeStyle)}">${escapeHtml(body)}</span>`);
  });

  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");
  const blocks = [];
  const paragraphLines = [];
  const quoteLines = [];
  const listState = { type: "ul", items: [], hasTasks: false };

  const flushAll = () => {
    flushTextileParagraph(blocks, paragraphLines);
    flushTextileList(blocks, listState);
    flushTextileQuote(blocks, quoteLines);
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Protected block HTML (pre/collapse/…) must not be wrapped in <p>
    if (/^@@TB_TPROT\d+@@$/.test(trimmed)) {
      flushAll();
      blocks.push(trimmed);
      continue;
    }

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushAll();
      blocks.push("<hr>");
      continue;
    }

    const headingMatch = trimmed.match(/^h([1-6])\.\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push(
        `<h${headingMatch[1]}>${renderInlineTextile(headingMatch[2])}</h${headingMatch[1]}>`
      );
      continue;
    }

    const quoteMatch = trimmed.match(/^bq\.\s+(.*)$/) || trimmed.match(/^&gt;\s?(.*)$/);
    if (quoteMatch) {
      flushTextileParagraph(blocks, paragraphLines);
      flushTextileList(blocks, listState);
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    // Textile pipe tables (no markdown separator required)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")) {
      const tableLines = [];
      let cursor = index;
      while (cursor < lines.length) {
        const row = lines[cursor].trim();
        if (!(row.startsWith("|") && row.endsWith("|"))) break;
        tableLines.push(row);
        cursor++;
      }
      if (tableLines.length >= 1) {
        flushAll();
        const cellsRows = tableLines.map(splitTableCells);
        const header = cellsRows[0];
        const bodyRows = cellsRows.slice(1);
        const thead = `<thead><tr>${header
          .map((cell) => `<th>${renderInlineTextile(cell)}</th>`)
          .join("")}</tr></thead>`;
        const tbody = bodyRows.length
          ? `<tbody>${bodyRows
              .map(
                (row) =>
                  `<tr>${header
                    .map((_h, i) => `<td>${renderInlineTextile(row[i] || "")}</td>`)
                    .join("")}</tr>`
              )
              .join("")}</tbody>`
          : "";
        blocks.push(`<div class="tb-preview-table-wrap"><table>${thead}${tbody}</table></div>`);
        index = cursor - 1;
        continue;
      }
    }

    const taskMatch = line.match(/^\s*\*\s+\[([ xX])\]\s+(.+)$/);
    const unorderedMatch = line.match(/^\s*\*\s+(.+)$/);
    const orderedMatch = line.match(/^\s*#\s+(.+)$/);
    if (taskMatch || unorderedMatch || orderedMatch) {
      flushTextileParagraph(blocks, paragraphLines);
      flushTextileQuote(blocks, quoteLines);
      const nextType = orderedMatch ? "ol" : "ul";
      if (listState.items.length && listState.type !== nextType) {
        flushTextileList(blocks, listState);
      }
      listState.type = nextType;
      if (taskMatch) {
        listState.hasTasks = true;
        const checked = /^x$/i.test(taskMatch[1]) ? " checked" : "";
        listState.items.push(
          `<li class="tb-task-list-item"><input type="checkbox" disabled${checked}> <span>${renderInlineTextile(
            taskMatch[2]
          )}</span></li>`
        );
      } else {
        listState.items.push(
          `<li>${renderInlineTextile((unorderedMatch || orderedMatch)[1])}</li>`
        );
      }
      continue;
    }

    flushTextileList(blocks, listState);
    flushTextileQuote(blocks, quoteLines);
    paragraphLines.push(line);
  }

  flushAll();

  let html = blocks.join("");
  for (let i = protections.length - 1; i >= 0; i--) {
    html = html.split(`@@TB_TPROT${i}@@`).join(protections[i]);
  }
  return html;
}

/**
 * Preview note as it will appear on Redmine (Markdown edit buffer → Textile → HTML).
 * @param {string} markdown
 * @returns {string}
 */
function renderRedmineNotePreview(markdown) {
  const textile =
    typeof markdownToTextile === "function" ? markdownToTextile(markdown) : String(markdown || "");
  return renderTextileHtml(textile);
}

window.escapeHtml = escapeHtml;
window.renderMarkdownHtml = renderMarkdownHtml;
window.renderTextileHtml = renderTextileHtml;
window.renderRedmineNotePreview = renderRedmineNotePreview;
