/**
 * Shared version-checking helpers for the service worker and options page.
 */
(function (global) {
  const API_URL = "https://dev-tool-platform-api.onrender.com/api";
  const GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/conghiep1997/b2r/releases/latest";
  const VERSION_PATTERN = /^\d+(?:\.\d+)*$/;

  function isValid(version) {
    return typeof version === "string" && VERSION_PATTERN.test(version);
  }

  function compare(firstVersion, secondVersion) {
    if (!isValid(firstVersion) || !isValid(secondVersion)) {
      throw new TypeError("Versions must contain numeric dot-separated segments.");
    }

    const firstParts = firstVersion.split(".").map(Number);
    const secondParts = secondVersion.split(".").map(Number);
    const length = Math.max(firstParts.length, secondParts.length);

    for (let index = 0; index < length; index++) {
      const first = firstParts[index] || 0;
      const second = secondParts[index] || 0;
      if (first > second) return 1;
      if (first < second) return -1;
    }

    return 0;
  }

  async function fetchLatest() {
    const backendVersion = await fetchLatestFromBackend();
    if (backendVersion) return backendVersion;

    return fetchLatestFromGitHub();
  }

  async function fetchLatestFromBackend() {
    try {
      const latestResponse = await fetch(`${API_URL}/versions/latest`);
      if (latestResponse.ok) {
        const latest = await latestResponse.json();
        if (isValid(latest?.version_number)) return latest;
      }

      const listResponse = await fetch(`${API_URL}/versions`);
      if (!listResponse.ok) {
        return null;
      }

      const payload = await listResponse.json();
      const versions = Array.isArray(payload) ? payload : payload?.versions || payload?.data || [];
      if (!versions.length) return null;

      return (
        versions.find((version) => version?.is_latest && isValid(version.version_number)) ||
        versions
          .filter((version) => isValid(version?.version_number))
          .sort((a, b) => compare(b.version_number, a.version_number))[0] ||
        null
      );
    } catch (_error) {
      return null;
    }
  }

  async function fetchLatestFromGitHub() {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const release = await response.json();
    const versionNumber = String(release?.tag_name || "").replace(/^v/i, "");
    if (!isValid(versionNumber)) {
      throw new Error("Server returned an invalid version.");
    }

    const zipAsset = (release.assets || []).find((asset) =>
      /Backlog2Redmine-v.+\.zip$/i.test(asset?.name || "")
    );

    return {
      name: release.name || `Backlog2Redmine v${versionNumber}`,
      version_number: versionNumber,
      description: release.body || "",
      download_url: zipAsset?.browser_download_url || release.html_url || "",
      release_date: release.published_at || release.created_at || "",
    };
  }

  global.TB_VERSION = Object.freeze({
    API_URL,
    compare,
    fetchLatest,
    isValid,
  });
})(globalThis);
