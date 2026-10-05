/**
 * Backlog API Service for Backlog2Redmine Extension.
 * Handles operations with Backlog API: sending comments, fetching issue info.
 */

async function getBacklogUsers(projectKeyOrIssueKey = null) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = getTrustedBacklogApiOrigin(settings.backlogDomain || TB.BACKLOG_DOMAIN);

  // Extract project key from issue key if provided (e.g., CTRIAL-123 → CTRIAL)
  let projectKey = null;
  if (projectKeyOrIssueKey) {
    const match = projectKeyOrIssueKey.match(/^([A-Z0-9_]+)-/);
    if (match) {
      projectKey = match[1];
    }
  }

  // Only use project-specific user API (requires Project Member+, not Admin)
  // https://developer.nulab.com/docs/backlog/api/2/get-project-user-list/
  if (!projectKey) {
    console.warn("[BacklogService] No valid project key provided, cannot fetch users");
    return [];
  }

  const url = new URL(`api/v2/projects/${projectKey}/users`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  console.log(`[BacklogService] Fetching users from: ${redactBacklogApiKey(url.toString())}`);
  console.log(`[BacklogService] Domain: ${domain}, Project: ${projectKey}`);

  try {
    const response = await timeoutFetch(url.toString(), { redirect: "error" });

    console.log(`[BacklogService] Response status: ${response.status}`);

    if (!response.ok) {
      const errorMsg = await readErrorMessage(response);
      console.warn(`[BacklogService] Failed to load users from project ${projectKey}: ${errorMsg}`);
      return [];
    }

    const users = await response.json();
    console.log(`[BacklogService] Loaded ${users.length} users from project ${projectKey}`);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      userId: u.userId,
      mailAddress: u.mailAddress,
    }));
  } catch (error) {
    console.warn("[BacklogService] Error fetching users:", error);
    return [];
  }
}

async function getBacklogIssueInfo(issueKey) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = getTrustedBacklogApiOrigin(settings.backlogDomain || TB.BACKLOG_DOMAIN);
  const url = new URL(`api/v2/issues/${issueKey}`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  const response = await timeoutFetch(url.toString(), { redirect: "error" });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `${TB.MESSAGES.BACKLOG.LOOKUP_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }

  const issue = await response.json();
  return {
    id: issue.id,
    key: issue.issueKey,
    keyId: issue.keyId,
    summary: issue.summary,
    description: issue.description,
    projectId: issue.projectId,
  };
}

async function handleSendToBacklog({
  backlogIssueKey,
  content,
  notifiedUserId,
  attachments = [],
  settingsOverride = null,
  syncMarker = "",
  onBeforeSubmit = null,
}) {
  const settings = settingsOverride || (await getSettings());
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = getTrustedBacklogApiOrigin(settings.backlogDomain || TB.BACKLOG_DOMAIN);
  const url = new URL(`api/v2/issues/${backlogIssueKey}/comments`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  const body = new URLSearchParams();
  body.append("content", `${content}${syncMarker ? `\n\n${syncMarker}` : ""}`);
  if (Array.isArray(notifiedUserId)) {
    notifiedUserId.forEach((id) => body.append("notifiedUserId[]", id));
  } else if (notifiedUserId) {
    notifiedUserId.split(",").forEach((id) => body.append("notifiedUserId[]", id.trim()));
  }

  // Backlog binds space upload IDs to the comment at creation time.
  // https://developer.nulab.com/docs/backlog/api/2/add-comment/
  const attachmentResults = await uploadAttachmentsToBacklog(
    domain,
    settings.backlogApiKey,
    attachments,
    settings.redmineDomain || TB.REDMINE_DOMAIN
  );
  for (const attachment of attachmentResults) {
    if (attachment.ok) body.append("attachmentId[]", attachment.attachmentId);
  }
  await onBeforeSubmit?.();
  const response = await timeoutFetch(url.toString(), {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    const error = new Error(
      `${TB.MESSAGES.BACKLOG.POST_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  const backlogUrl = `${domain.endsWith("/") ? domain : domain + "/"}view/${backlogIssueKey}#comment-${result.id}`;

  return {
    message: TB.MESSAGES.TOAST.SEND_BACKLOG_SUCCESS,
    backlogUrl,
    commentId: result.id,
    attachmentResults,
    partial: attachmentResults.some((attachment) => !attachment.ok),
  };
}

async function uploadAttachmentsToBacklog(domain, apiKey, attachments, redmineDomain) {
  const results = [];
  for (const attachment of attachments) {
    try {
      const blob = await downloadRedmineAttachment(attachment.url, redmineDomain);
      const uploadUrl = new URL("api/v2/space/attachment", domain);
      uploadUrl.searchParams.set("apiKey", apiKey);

      const formData = new FormData();
      formData.append("file", blob, attachment.filename);

      const uploadResponse = await timeoutFetch(
        uploadUrl.toString(),
        {
          method: "POST",
          redirect: "error",
          body: formData,
        },
        60000
      );

      if (!uploadResponse.ok) {
        throw new Error(`HTTP ${uploadResponse.status}`);
      }
      const uploaded = await uploadResponse.json();
      if (!Number.isSafeInteger(uploaded?.id) || uploaded.id <= 0) {
        throw new Error("Invalid attachment upload ID.");
      }
      results.push({ filename: attachment.filename, ok: true, attachmentId: uploaded.id });
    } catch (error) {
      results.push({
        filename: attachment.filename,
        ok: false,
        error: sanitizeErrorMessage(error.message),
      });
    }
  }
  return results;
}

async function downloadRedmineAttachment(url, redmineDomain) {
  const destination = new URL(url);
  const configured = new URL(redmineDomain);
  const basePath = configured.pathname.replace(/\/$/, "");
  if (
    destination.origin !== configured.origin ||
    destination.username ||
    destination.password ||
    !destination.pathname.startsWith(`${basePath}/attachments/download/`) ||
    !/^\d+(?:\/|$)/.test(destination.pathname.slice(`${basePath}/attachments/download/`.length))
  ) {
    throw new Error("Attachment URL is outside the configured Redmine workspace.");
  }
  const response = await timeoutFetch(
    destination.href,
    { credentials: "include", redirect: "error" },
    60000
  );
  if (!response.ok) {
    throw new Error(`Redmine attachment download failed: ${response.status}`);
  }
  return await response.blob();
}

function redactBacklogApiKey(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.searchParams.has("apiKey")) {
      parsedUrl.searchParams.set("apiKey", "[REDACTED]");
    }
    return parsedUrl.toString();
  } catch (_error) {
    return String(url).replace(/([?&]apiKey=)[^&]+/i, "$1[REDACTED]");
  }
}

function isUsableAttachmentBlob(blob, contentType = "") {
  if (!blob || blob.size <= 0) {
    return false;
  }
  const type = String(contentType || blob.type || "").toLowerCase();
  // Login HTML / JSON error bodies are not real attachment bytes.
  if (type.includes("text/html") || type.includes("application/json")) {
    return false;
  }
  return true;
}

async function downloadBacklogFile(domain, attachmentId, filename = "", issueKey = "") {
  const settings = await getSettings();
  const backlogBase = settings.backlogDomain || TB.BACKLOG_DOMAIN;
  const safeFilename = filename || String(attachmentId);

  // Try API first if we have a key and issueKey
  if (settings.backlogApiKey && issueKey) {
    try {
      const origin = getTrustedBacklogApiOrigin(backlogBase);
      const normalizedBase = `${origin}/`;
      const apiUrl = new URL(
        `api/v2/issues/${issueKey}/attachments/${attachmentId}`,
        normalizedBase
      );
      apiUrl.searchParams.set("apiKey", settings.backlogApiKey);

      const apiRes = await timeoutFetch(apiUrl.toString(), { redirect: "error" }, 60000);
      if (apiRes.ok) {
        const contentType = apiRes.headers.get("content-type") || "";
        const blob = await apiRes.blob();
        if (isUsableAttachmentBlob(blob, contentType)) {
          return blob;
        }
        console.warn(
          `[BacklogService] API download returned unusable body (${contentType || "unknown"}, ${blob.size} bytes), falling back to web URL.`
        );
      } else {
        console.warn(
          `[BacklogService] API download failed (${apiRes.status}), falling back to web URL.`
        );
      }
    } catch (e) {
      console.warn("[BacklogService] API download error, falling back to web URL:", e);
    }
  }

  // Fallback to web download URL (requires user session).
  // domain may be hostname (from tab) or full URL (from settings) — normalize either form.
  const origin =
    normalizeBacklogOrigin(domain) ||
    normalizeBacklogOrigin(backlogBase) ||
    normalizeBacklogOrigin(TB.BACKLOG_DOMAIN);
  if (!origin) {
    throw new Error("Backlog domain is not configured. Cannot download attachments.");
  }

  const webUrl = `${origin}/downloadAttachment/${attachmentId}/${encodeURIComponent(safeFilename)}`;
  const response = await timeoutFetch(webUrl, { credentials: "include" }, 60000);

  if (!response.ok) {
    throw new Error(`Backlog file download failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const blob = await response.blob();
  if (!isUsableAttachmentBlob(blob, contentType)) {
    throw new Error(
      `Backlog file download returned invalid content (${contentType || "unknown"}, ${blob.size} bytes). Check login session.`
    );
  }

  return blob;
}
