/** Pure selection transforms shared by preview and migration submission. */
(function (global) {
  const markers = /\[\[TB_(IMG|FILE):\s*(\d+)(?::\s*([^\]]+?))?\s*\]\]/g;
  function files(texts) {
    const result = new Map();
    for (const text of texts) {
      for (const match of String(text || "").matchAll(markers)) {
        result.set(match[2], {
          id: match[2],
          filename: match[3]?.trim() || `image_${match[2]}.png`,
        });
      }
    }
    return [...result.values()];
  }
  function plan(description, comments, excludedComments = new Set(), excludedFiles = new Set()) {
    const selectedIndexes = comments
      .map((text, index) =>
        !excludedComments.has(index) && String(text || "").trim() ? index : -1
      )
      .filter((index) => index >= 0);
    const texts = [description, ...selectedIndexes.map((index) => comments[index])];
    const chosenFiles = files(texts).filter((file) => !excludedFiles.has(file.id));
    const clean = (text) =>
      String(text || "").replace(markers, (token, type, id) =>
        excludedFiles.has(id) ? "" : token
      );
    return {
      description: clean(description),
      comments: selectedIndexes.map((index) => clean(comments[index])),
      selection: { commentIndexes: selectedIndexes, fileIds: chosenFiles.map((file) => file.id) },
      files: chosenFiles,
    };
  }
  global.TB_MIGRATION_SELECTION = Object.freeze({ files, plan });
})(globalThis);
