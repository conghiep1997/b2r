/**
 * Main Constants Entry Point for Backlog2Redmine Extension.
 * Aggregates modular constants and provides i18n support.
 */
(function (global) {
  // Vietnamese messages remain the legacy content-script fallback. Popup, Options,
  // and Redmine report UI use the locale preference with English as the default.
  const viMessages = {
    button_title: "Dịch bình luận và gửi sang Redmine",
    button_text: "Redmine",
    button_title_backlog: "Đồng bộ nội dung tiếng Nhật sang Backlog",
    migrate_button_text: "Di chuyển Issue",
    processing: "Đang xử lý...",
    toast_no_comment_content: "Không tìm thấy nội dung bình luận.",
    toast_empty_comment: "Nội dung bình luận đang trống.",
    toast_missing_issue_key: "Không đọc được mã Issue từ Backlog.",
    toast_send_success: "Đã gửi bình luận lên Redmine thành công.",
    toast_send_backlog_success: "Đã gửi bình luận lên Backlog thành công.",
    toast_send_failed: "Gửi bình luận thất bại.",
    toast_translation_failed: "Dịch bình luận thất bại.",
    toast_rate_limit_retry:
      "Model chính chạm giới hạn (rate limit), đang thử lại với model dự phòng...",
    toast_rate_limit_failed: "Cả 2 model đều chạm giới hạn. Vui lòng đợi hoặc kiểm tra API key.",
    toast_cross_provider_retry: "$provider$ chạm giới hạn, đang chuyển sang Gemini Flash Lite...",
    modal_title: "Gửi bình luận sang Redmine",
    modal_subtitle: "",
    modal_issue_id_label: "Mã Issue Redmine",
    modal_issue_title_label: "Tiêu đề Issue Redmine",
    modal_backlog_issue_title_label: "Tiêu đề Issue Backlog",
    modal_preview_label: "Nội dung",
    modal_preview_description: "Mô tả",
    modal_preview_comments: "Bình luận",
    modal_note_prefix: "Bình luận",
    modal_char_count: "$count$ ký tự",
    modal_preview_toggle_show: "Xem trước",
    modal_preview_toggle_redmine: "Redmine",
    modal_preview_toggle_show_title: "Bấm để xem trước kiểu note Redmine",
    modal_preview_toggle_redmine_title: "Đang xem trước kiểu Redmine — bấm để sửa",
    modal_hint: "Mẹo: Có thể gõ @tên_người_dùng trước khi gửi; Redmine sẽ nhận diện nếu tên đúng.",
    modal_confirm: "Xác nhận & Gửi",
    modal_cancel: "Hủy bỏ",
    modal_close_aria: "Đóng",
    modal_sending: "Đang gửi...",
    modal_empty_issue_id: "Vui lòng nhập mã Issue Redmine.",
    modal_empty_notes: "Nội dung gửi không được để trống.",
    modal_success_title: "Hoàn thành!",
    modal_success_subtitle: "Bình luận đã được gửi thành công sang Redmine.",
    modal_success_view_button: "Xem trên Redmine",
    modal_success_close_button: "Đóng",
    modal_success_hide_again_label: "Không hiển thị lại (chỉ áp dụng khi dịch comment)",
    modal_notify_users_label: "Gắn thêm người (ví dụ: 12345, 67890)",
    modal_loading_title: "Đang tải tiêu đề...",
    modal_error_numeric_id: "ID phải là chữ số!",
    modal_error_not_found: "Không tìm thấy Issue hoặc lỗi kết nối!",
    modal_batch_title_multiple: "Đã gửi thành công $count$ bình luận!",
    modal_batch_subtitle_multiple: "Tất cả bình luận đã được dịch và gửi sang Redmine.",
    modal_batch_subtitle_preparing: "Sẽ dịch và gửi $count$ bình luận liên tiếp.",
    modal_batch_text: "Dịch toàn bộ bình luận đến cuối cùng ($count$ bình luận)",
    modal_batch_confirm: "Dịch & Gửi $count$ bình luận",
    modal_batch_count_changed_warning: "Số lượng bình luận đã thay đổi",
    modal_waiting_translation: "[Đang chờ xác nhận để dịch thêm...]",
    modal_backlog_title: "Gửi bình luận sang Backlog",
    modal_backlog_subtitle: "",
    modal_backlog_issue_key_label: "Mã Issue Backlog",
    modal_backlog_placeholder: "Ví dụ: CTRIAL-31",
    modal_backlog_empty_key: "Vui lòng nhập mã Issue Backlog.",
    modal_backlog_success_title: "Hoàn thành!",
    modal_backlog_success_subtitle: "Bình luận đã được gửi thành công sang Backlog.",
    modal_backlog_success_view_button: "Xem trên Backlog",
    modal_migrate_title: "Tạo Issue mới trên Redmine",
    modal_migrate_subtitle: "Tạo 1 issue và kèm $count$ bình luận.",
    modal_migrate_confirm: "Tạo & Di chuyển toàn bộ",
    modal_migrate_comments_text: "Dịch và di chuyển tất cả $count$ bình luận",
    modal_project_label: "Dự án Redmine",
    modal_tracker_label: "Loại công việc (Tracker)",
    modal_priority_label: "Mức độ ưu tiên",
    modal_subject_label: "Tiêu đề Issue",
    modal_loading_metadata: "Đang tải danh sách dữ liệu...",
    modal_error_select_project: "Vui lòng chọn dự án Redmine.",
    modal_error_metadata: "Không thể tải dữ liệu từ Redmine.",
    modal_version_label: "Phiên bản mục tiêu (Milestone)",
    modal_due_date_label: "Hạn hoàn thành",
    modal_due_date_required_label: "Hạn hoàn thành*",
    modal_issue_id_placeholder: "Ví dụ: 12345",
    modal_select_placeholder: "-- Chọn --",
    modal_version_loading: "-- Đang tải phiên bản --",
    modal_version_empty: "-- Trống --",
    modal_version_error: "-- Lỗi tải phiên bản --",
    settings_incomplete: "Cấu hình extension chưa đầy đủ.",
    settings_open_link: "Bấm vào đây để sửa.",
    settings_runtime_unavailable: "Runtime extension không khả dụng. Vui lòng tải lại trang.",
    settings_redmine_domain_required: "Thiếu tên miền Redmine trong trang Tùy chọn.",
    settings_redmine_api_key_required: "Thiếu Redmine API key trong trang Tùy chọn.",
    settings_backlog_api_key_required: "Thiếu Backlog API key trong trang Tùy chọn.",
    settings_gemini_api_key_required: "Thiếu Gemini API key trong trang Tùy chọn.",
    options_gemini_key_required: "Vui lòng nhập Gemini API key.",
    options_cerebras_key_required: "Vui lòng nhập Cerebras API key.",
    options_save_success: "Cấu hình đã được lưu thành công!",
    options_save_error: "Lỗi khi lưu: $error$",
    settings_options_save_success: "Cấu hình đã được lưu thành công!",
    settings_options_save_error: "Lỗi khi lưu: $error$",
    options_saved_placeholder: "********** (Đã lưu)",
    redmine_lookup_failed: "Không tìm thấy Issue tương ứng trên Redmine.",
    redmine_search_empty_html: "Trang tìm kiếm Redmine trả về dữ liệu rỗng.",
    redmine_search_no_match: "Không tìm thấy kết quả khớp trong HTML, đang chuyển sang API...",
    redmine_search_page_error: "Trang tìm kiếm Redmine xảy ra lỗi.",
    redmine_api_request_failed: "Yêu cầu đến API Redmine thất bại.",
    gemini_empty_translation: "AI không trả về nội dung dịch.",
    gemini_rate_limit_error: "Model chạm giới hạn (429 Too Many Requests)",
    fallback_no_fallback: "Không dùng dự phòng",
    backlog_lookup_failed: "Không tìm thấy Issue tương ứng trên Backlog.",
    backlog_post_failed: "Gửi bình luận lên Backlog thất bại.",
    modal_no_mention_found: "Không có @mention nào",
  };

  let localeMessages = null;
  const toMessageKey = (value) => value.toLowerCase();

  const getMsg = (key, substitution) => {
    try {
      const localized = localeMessages?.[key]?.message;
      if (localized) {
        let message = localized;
        if (substitution !== null && substitution !== undefined && substitution !== "") {
          const value = String(substitution);
          message = message
            .replace(/\$count\$/g, value)
            .replace(/\$error\$/g, value)
            .replace(/\$provider\$/g, value)
            .replace(/\$1\$/g, value);
        }
        return message;
      }

      if (Object.prototype.hasOwnProperty.call(viMessages, key)) {
        let viMsg = viMessages[key];
        if (substitution !== null && substitution !== undefined && substitution !== "") {
          const value = String(substitution);
          viMsg = String(viMsg)
            .replace(/\$count\$/g, value)
            .replace(/\$error\$/g, value)
            .replace(/\$provider\$/g, value)
            .replace(/\$1\$/g, value);
        }
        return viMsg;
      }

      // Fall back to the manifest's default English catalog.
      const msg = chrome.i18n?.getMessage(key, substitution);
      if (msg && msg !== key) {
        return msg;
      }

      return key;
    } catch (e) {
      console.error("[TB] i18n error:", e);
      return viMessages[key] || key;
    }
  };

  const createMessagesProxy = (source, prefix = "") =>
    new Proxy(source, {
      get(target, property, receiver) {
        if (typeof property !== "string") return Reflect.get(target, property, receiver);
        const value = Reflect.get(target, property, receiver);
        const key = `${prefix}${toMessageKey(property)}`;
        if (value && typeof value === "object") {
          return createMessagesProxy(value, `${key}_`);
        }
        if (typeof value === "function") {
          return value;
        }
        const msg = getMsg(key);
        if (msg !== key) {
          return msg;
        }
        return typeof value === "string" ? value : msg;
      },
    });

  global.TB_SET_LOCALE_MESSAGES = (messages) => {
    localeMessages = messages;
  };
  global.TB_GET_MESSAGE = getMsg;

  global.TB_CONSTANTS = Object.freeze({
    DEBUG_PREFIX: "[TB-Redmine]",
    LOG_LEVEL: "debug",

    // Use values from modular constants if loaded, otherwise defaults
    GEMINI_MODEL: global.TB_MODELS?.GEMINI || "gemini-3.1-flash-lite",
    GEMINI_FALLBACK_MODEL: global.TB_MODELS?.GEMINI_FALLBACK || "gemini-3.1-flash-lite",
    CEREBRAS_MODEL: global.TB_MODELS?.CEREBRAS || "gpt-oss-120b",
    GROQ_MODEL: global.TB_MODELS?.GROQ || "llama-3.3-70b-versatile",
    DEFAULT_PROVIDER: "gemini",

    PROVIDERS: {
      GEMINI: "gemini",
      GROQ: "groq",
      CEREBRAS: "cerebras",
      OPENROUTER: "openrouter",
      NONE: "none",
    },

    DEFAULT_PRIMARY_PROVIDER: "gemini",
    DEFAULT_PRIMARY_MODEL: "gemini-3.1-flash-lite",
    DEFAULT_FALLBACK_PROVIDER: "none",
    DEFAULT_FALLBACK_MODEL: "",

    BACKLOG_DOMAIN: "https://example.backlog.com",
    REDMINE_DOMAIN: "https://redmine.splus-software.com",

    GEMINI_MODELS: global.TB_MODELS?.GEMINI_MODELS || [],
    CEREBRAS_MODELS: global.TB_MODELS?.CEREBRAS_MODELS || [],
    GROQ_MODELS: global.TB_MODELS?.GROQ_MODELS || [],
    OPENROUTER_MODELS: global.TB_MODELS?.OPENROUTER_MODELS || [],

    ICONS: global.TB_ICONS || {},

    MESSAGES: createMessagesProxy({
      BUTTON_TITLE: getMsg("button_title"),
      BUTTON_ARIA: getMsg("button_title"),
      BUTTON_TEXT: getMsg("button_text"),
      BUTTON_TITLE_BACKLOG: getMsg("button_title_backlog"),
      MIGRATE_BUTTON_TEXT: getMsg("migrate_button_text"),
      PROCESSING: getMsg("processing"),
      TOAST: {
        NO_COMMENT_CONTENT: getMsg("toast_no_comment_content"),
        EMPTY_COMMENT: getMsg("toast_empty_comment"),
        MISSING_ISSUE_KEY: getMsg("toast_missing_issue_key"),
        SEND_SUCCESS: getMsg("toast_send_success"),
        SEND_BACKLOG_SUCCESS: getMsg("toast_send_backlog_success"),
        SEND_FAILED: getMsg("toast_send_failed"),
        TRANSLATION_FAILED: getMsg("toast_translation_failed"),
        RATE_LIMIT_RETRY: getMsg("toast_rate_limit_retry"),
        RATE_LIMIT_FAILED: getMsg("toast_rate_limit_failed"),
        CROSS_PROVIDER_RETRY: (provider) => getMsg("toast_cross_provider_retry", provider),
      },
      MODAL: {
        TITLE: getMsg("modal_title"),
        SUBTITLE: getMsg("modal_subtitle"),
        ISSUE_ID_LABEL: getMsg("modal_issue_id_label"),
        ISSUE_TITLE_LABEL: getMsg("modal_issue_title_label"),
        BACKLOG_ISSUE_TITLE_LABEL: getMsg("modal_backlog_issue_title_label"),
        PREVIEW_LABEL: getMsg("modal_preview_label"),
        PREVIEW_DESCRIPTION: getMsg("modal_preview_description"),
        PREVIEW_COMMENTS: getMsg("modal_preview_comments"),
        NOTE_PREFIX: getMsg("modal_note_prefix"),
        CHAR_COUNT: (count) => getMsg("modal_char_count", String(count)),
        PREVIEW_TOGGLE_SHOW: getMsg("modal_preview_toggle_show"),
        PREVIEW_TOGGLE_REDMINE: getMsg("modal_preview_toggle_redmine"),
        PREVIEW_TOGGLE_SHOW_TITLE: getMsg("modal_preview_toggle_show_title"),
        PREVIEW_TOGGLE_REDMINE_TITLE: getMsg("modal_preview_toggle_redmine_title"),
        HINT: getMsg("modal_hint"),
        CONFIRM: getMsg("modal_confirm"),
        CANCEL: getMsg("modal_cancel"),
        CLOSE_ARIA: getMsg("modal_close_aria"),
        SENDING: getMsg("modal_sending"),
        EMPTY_ISSUE_ID: getMsg("modal_empty_issue_id"),
        EMPTY_NOTES: getMsg("modal_empty_notes"),
        SUCCESS_TITLE: getMsg("modal_success_title"),
        SUCCESS_SUBTITLE: getMsg("modal_success_subtitle"),
        SUCCESS_VIEW_BUTTON: getMsg("modal_success_view_button"),
        SUCCESS_CLOSE_BUTTON: getMsg("modal_success_close_button"),
        SUCCESS_HIDE_AGAIN_LABEL: getMsg("modal_success_hide_again_label"),
        NOTIFY_USERS_LABEL: getMsg("modal_notify_users_label"),
        BACKLOG_ISSUE_KEY_LABEL: getMsg("modal_backlog_issue_key_label"),
        MIGRATE_TITLE: getMsg("modal_migrate_title"),
        MIGRATE_SUBTITLE: (count) => getMsg("modal_migrate_subtitle", count.toString()),
        MIGRATE_CONFIRM: getMsg("modal_migrate_confirm"),
        MIGRATE_COMMENTS_TEXT: (count) => getMsg("modal_migrate_comments_text", count.toString()),
        PROJECT_LABEL: getMsg("modal_project_label"),
        TRACKER_LABEL: getMsg("modal_tracker_label"),
        PRIORITY_LABEL: getMsg("modal_priority_label"),
        SUBJECT_LABEL: getMsg("modal_subject_label"),
        VERSION_LABEL: getMsg("modal_version_label"),
        DUE_DATE_LABEL: getMsg("modal_due_date_label"),
        DUE_DATE_REQUIRED_LABEL: getMsg("modal_due_date_required_label"),
        ISSUE_ID_PLACEHOLDER: getMsg("modal_issue_id_placeholder"),
        SELECT_PLACEHOLDER: getMsg("modal_select_placeholder"),
        VERSION_LOADING: getMsg("modal_version_loading"),
        VERSION_EMPTY: getMsg("modal_version_empty"),
        VERSION_ERROR: getMsg("modal_version_error"),
        LOADING_METADATA: getMsg("modal_loading_metadata"),
        WAITING_TRANSLATION: getMsg("modal_waiting_translation"),
        LOADING_TITLE: getMsg("modal_loading_title"),
        ERROR_NUMERIC_ID: getMsg("modal_error_numeric_id"),
        ERROR_NOT_FOUND: getMsg("modal_error_not_found"),
        ERROR_SELECT_PROJECT: getMsg("modal_error_select_project"),
        BACKLOG_TITLE: getMsg("modal_backlog_title"),
        BACKLOG_SUBTITLE: getMsg("modal_backlog_subtitle"),
        BACKLOG_PLACEHOLDER: getMsg("modal_backlog_placeholder"),
        BACKLOG_EMPTY_KEY: getMsg("modal_backlog_empty_key"),
        BACKLOG_SUCCESS_TITLE: getMsg("modal_backlog_success_title"),
        BACKLOG_SUCCESS_SUBTITLE: getMsg("modal_backlog_success_subtitle"),
        BACKLOG_SUCCESS_VIEW_BUTTON: getMsg("modal_backlog_success_view_button"),
        BATCH_TITLE_MULTIPLE: (count) => getMsg("modal_batch_title_multiple", count.toString()),
        BATCH_SUBTITLE_MULTIPLE: getMsg("modal_batch_subtitle_multiple"),
        BATCH_SUBTITLE_PREPARING: (count) =>
          getMsg("modal_batch_subtitle_preparing", count.toString()),
        ERROR_METADATA: getMsg("modal_error_metadata"),
        BATCH_TEXT: (count) => getMsg("modal_batch_text", count.toString()),
        BATCH_CONFIRM: (count) => getMsg("modal_batch_confirm", count.toString()),
        BATCH_COUNT_CHANGED_WARNING: getMsg("modal_batch_count_changed_warning"),
      },
      SETTINGS: {
        INCOMPLETE: getMsg("settings_incomplete"),
        OPEN_LINK: getMsg("settings_open_link"),
        RUNTIME_UNAVAILABLE: getMsg("settings_runtime_unavailable"),
        REDMINE_DOMAIN_REQUIRED: getMsg("settings_redmine_domain_required"),
        REDMINE_API_KEY_REQUIRED: getMsg("settings_redmine_api_key_required"),
        BACKLOG_API_KEY_REQUIRED: getMsg("settings_backlog_api_key_required"),
        GEMINI_API_KEY_REQUIRED: getMsg("settings_gemini_api_key_required"),
        OPTIONS_GEMINI_KEY_REQUIRED: getMsg("options_gemini_key_required"),
        OPTIONS_CEREBRAS_KEY_REQUIRED: getMsg("options_cerebras_key_required"),
        OPTIONS_SAVE_SUCCESS: getMsg("options_save_success"),
        OPTIONS_SAVE_ERROR: (err) => getMsg("options_save_error", err),
        OPTIONS_SAVED_PLACEHOLDER: getMsg("options_saved_placeholder"),
      },
      REDMINE: {
        LOOKUP_FAILED: getMsg("redmine_lookup_failed"),
        SEARCH_EMPTY_HTML: getMsg("redmine_search_empty_html"),
        SEARCH_NO_MATCH: getMsg("redmine_search_no_match"),
        SEARCH_PAGE_ERROR: getMsg("redmine_search_page_error"),
        API_REQUEST_FAILED: getMsg("redmine_api_request_failed"),
      },
      GEMINI: {
        EMPTY_TRANSLATION: getMsg("gemini_empty_translation"),
        RATE_LIMIT_ERROR: getMsg("gemini_rate_limit_error"),
      },
      FALLBACK: {
        NO_FALLBACK: getMsg("fallback_no_fallback"),
      },
      BACKLOG: {
        LOOKUP_FAILED: getMsg("backlog_lookup_failed"),
        POST_FAILED: getMsg("backlog_post_failed"),
      },
    }),
    PROMPTS: global.TB_PROMPTS || {},
  });

  global.TB = global.TB_CONSTANTS;
})(globalThis);
