const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDirVi = path.resolve("store_assets/screenshots_vi");
const outDirEn = path.resolve("store_assets/screenshots_en");

if (!fs.existsSync(outDirVi)) fs.mkdirSync(outDirVi, { recursive: true });
if (!fs.existsSync(outDirEn)) fs.mkdirSync(outDirEn, { recursive: true });

const commonStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #090e17;
    background-image: 
      radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.12) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
      radial-gradient(at 50% 50%, rgba(62, 91, 163, 0.08) 0px, transparent 60%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 36px 48px 30px;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .badge-tag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
  }

  .header {
    text-align: center;
    max-width: 960px;
    margin-bottom: 24px;
  }
  .header h1 {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
    background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
  }
  .header p {
    font-size: 15px;
    color: #94a3b8;
    line-height: 1.45;
  }

  /* Mockup Frame */
  .window-frame {
    width: 100%;
    max-width: 1180px;
    flex: 1;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 14px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .window-titlebar {
    height: 38px;
    background: #131d31;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 12px;
  }
  .traffic-lights {
    display: flex;
    gap: 7px;
  }
  .traffic-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }
  .traffic-red { background: #ef4444; }
  .traffic-yellow { background: #f59e0b; }
  .traffic-green { background: #10b981; }
  .window-address {
    flex: 1;
    max-width: 520px;
    height: 24px;
    background: #0a101d;
    border: 1px solid #243247;
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    color: #64748b;
    gap: 6px;
  }
  .window-address span { color: #94a3b8; font-family: monospace; }
  .window-content {
    flex: 1;
    padding: 20px;
    background: #0b111e;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
`;

function buildTemplate({
  badge,
  title,
  subtitle,
  contentHtml,
  url = "https://workspace.backlog.com/view/PROJ-104",
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  ${commonStyles}
</style>
</head>
<body>
  <div class="badge-tag"><div class="badge-tag-dot"></div> ${badge}</div>
  <div class="header">
    <h1>${title}</h1>
    <p>${subtitle}</p>
  </div>
  <div class="window-frame">
    <div class="window-titlebar">
      <div class="traffic-lights">
        <div class="traffic-dot traffic-red"></div>
        <div class="traffic-dot traffic-yellow"></div>
        <div class="traffic-dot traffic-green"></div>
      </div>
      <div class="window-address">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#10b981"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        <span>${url}</span>
      </div>
    </div>
    <div class="window-content">
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

// Data for the 5 screenshots in Vietnamese and English
const screenshots = [
  // 1. Bi-directional Sync & AI Translation
  {
    name: "01_bi_directional_sync",
    url: "https://workspace.backlog.com/view/PROJ-104",
    vi: {
      badge: "Đồng bộ 2 chiều • AI Translation v1.8.24",
      title: "Đồng bộ bình luận 2 chiều Backlog ⟷ Redmine",
      subtitle:
        "Dịch thuật tự động Nhật – Việt – Anh bằng AI (Gemini, Groq, Cerebras) với định dạng chuẩn xác và đồng bộ file đính kèm tức thì.",
      content: `
        <div style="display: grid; grid-template-columns: 1fr 64px 1fr; gap: 16px; height: 100%; align-items: center;">
          <!-- Left: Backlog Side -->
          <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #243247;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #f87171; font-size: 14px;">Backlog Issue</span>
                <span style="background: #243247; color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: monospace;">CTRIAL-104</span>
              </div>
              <span style="font-size: 12px; color: #64748b;">Hôm nay, 10:15</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px;">Takashi Yamada (QA Lead):</div>
            <div style="background: #0b111e; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; color: #cbd5e1; flex: 1;">
              最新のビルド環境にて検証を行いました。<br>
              ログイン画面のレイアウト崩れは修正されていることを確認しました。<br>
              詳細ログとスクリーンショットを添付いたしますのでご確認ください。
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #243247; display: flex; gap: 8px;">
                <span style="background: #1e293b; color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 4px;">📎 test_result_v2.png (340 KB)</span>
              </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
              <div style="background: #3e5ba3; color: #fff; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">
                <span>Gửi sang Redmine (B2R)</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
              </div>
            </div>
          </div>

          <!-- Middle: Sync Flow -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #1e293b; border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(56,189,248,0.25);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
            </div>
            <span style="font-size: 10px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 3px 6px; border-radius: 4px; text-align: center; white-space: nowrap;">AI Dịch 0.3s</span>
            <span style="font-size: 9px; color: #64748b;">Gemini 2.5</span>
          </div>

          <!-- Right: Redmine Side -->
          <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #243247;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">Redmine Issue</span>
                <span style="background: #243247; color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: monospace;">#14258</span>
              </div>
              <span style="font-size: 11px; color: #4ade80; background: rgba(74,222,128,0.15); padding: 2px 8px; border-radius: 4px; font-weight: 600;">✓ Đã đồng bộ</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px;">Ghi chú đồng bộ từ Backlog:</div>
            <div style="background: #0b111e; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; color: #cbd5e1; flex: 1;">
              <div style="color: #9bb4f5; font-size: 12px; margin-bottom: 6px;">[Dịch tự động bởi AI]</div>
              Chúng tôi đã tiến hành kiểm tra trên môi trường build mới nhất.<br>
              Xác nhận lỗi vỡ giao diện trên màn hình đăng nhập đã được sửa chữa thành công.<br>
              Tôi đính kèm log chi tiết và ảnh chụp màn hình để bạn kiểm tra.
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #243247; display: flex; align-items: center; justify-content: space-between;">
                <span style="background: #1e293b; color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 4px;">📎 test_result_v2.png</span>
                <span style="font-size: 11px; color: #64748b;">Nguồn: CTRIAL-104</span>
              </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #94a3b8;">Trạng thái: Hoàn thành 100%</span>
              <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">Xem chi tiết Redmine ↗</span>
            </div>
          </div>
        </div>
      `,
    },
    en: {
      badge: "2-Way Sync • AI Translation v1.8.24",
      title: "Seamless Bi-directional Comment Sync (Backlog ⟷ Redmine)",
      subtitle:
        "Automatic Japanese, Vietnamese & English AI translation (Gemini, Groq, Cerebras) preserving markdown structure and attachments.",
      content: `
        <div style="display: grid; grid-template-columns: 1fr 64px 1fr; gap: 16px; height: 100%; align-items: center;">
          <!-- Left: Backlog Side -->
          <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #243247;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #f87171; font-size: 14px;">Backlog Issue</span>
                <span style="background: #243247; color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: monospace;">CTRIAL-104</span>
              </div>
              <span style="font-size: 12px; color: #64748b;">Today, 10:15</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px;">Takashi Yamada (QA Lead):</div>
            <div style="background: #0b111e; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; color: #cbd5e1; flex: 1;">
              最新のビルド環境にて検証を行いました。<br>
              ログイン画面のレイアウト崩れは修正されていることを確認しました。<br>
              詳細ログとスクリーンショットを添付いたしますのでご確認ください。
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #243247; display: flex; gap: 8px;">
                <span style="background: #1e293b; color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 4px;">📎 test_result_v2.png (340 KB)</span>
              </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
              <div style="background: #3e5ba3; color: #fff; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">
                <span>Send to Redmine (B2R)</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
              </div>
            </div>
          </div>

          <!-- Middle: Sync Flow -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #1e293b; border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(56,189,248,0.25);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
            </div>
            <span style="font-size: 10px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 3px 6px; border-radius: 4px; text-align: center; white-space: nowrap;">AI Sync 0.3s</span>
            <span style="font-size: 9px; color: #64748b;">Gemini 2.5</span>
          </div>

          <!-- Right: Redmine Side -->
          <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #243247;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">Redmine Issue</span>
                <span style="background: #243247; color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: monospace;">#14258</span>
              </div>
              <span style="font-size: 11px; color: #4ade80; background: rgba(74,222,128,0.15); padding: 2px 8px; border-radius: 4px; font-weight: 600;">✓ Synced</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px;">Synchronized Note from Backlog:</div>
            <div style="background: #0b111e; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; color: #cbd5e1; flex: 1;">
              <div style="color: #9bb4f5; font-size: 12px; margin-bottom: 6px;">[AI Translated Note]</div>
              Verification was performed on the latest build environment.<br>
              Confirmed that the layout corruption issue on login screen has been fixed.<br>
              Detailed logs and screenshots are attached for your reference.
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #243247; display: flex; align-items: center; justify-content: space-between;">
                <span style="background: #1e293b; color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 4px;">📎 test_result_v2.png</span>
                <span style="font-size: 11px; color: #64748b;">Source: CTRIAL-104</span>
              </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #94a3b8;">Status: Complete (100%)</span>
              <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">View in Redmine ↗</span>
            </div>
          </div>
        </div>
      `,
    },
  },

  // 2. Redmine Monthly Worklog & Time Tracking
  {
    name: "02_redmine_monthly_worklog",
    url: "https://redmine.splus-software.com/time_entries",
    vi: {
      badge: "Ghi log thời gian • Redmine Time Tracker",
      title: "Báo cáo & Ghi log thời gian làm việc hàng tháng",
      subtitle:
        "Tự động kiểm tra trùng lặp, tính tổng giờ chính xác, hỗ trợ chuyển đổi tháng mượt mà và gán Activity hàng loạt chỉ với 1 click.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Top Toolbar: Month Picker & Summary Stats -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #131d31; padding: 12px 16px; border-radius: 10px; border: 1px solid #1e293b;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 700; font-size: 15px; color: #f1f5f9;">Báo cáo tháng:</span>
              <div style="display: inline-flex; align-items: center; background: #0f172a; padding: 3px; border: 1px solid #334155; border-radius: 8px; gap: 4px;">
                <button style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                </button>
                <input type="text" value="October 2026" readonly style="height: 28px; padding: 2px 12px; border: 1px solid #334155; border-radius: 6px; background: #1e293b; color: #f1f5f9; font-size: 13px; font-weight: 600; width: 130px; text-align: center;">
                <button style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </button>
                <button style="height: 28px; padding: 0 10px; background: #1e293b; border: 1px solid #334155; color: #9bb4f5; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer;">Tháng này</button>
              </div>
            </div>

            <!-- Stats -->
            <div style="display: flex; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Tổng giờ:</span> <strong style="font-size: 14px; color: #38bdf8;">168.0h</strong>
              </div>
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Ngày làm:</span> <strong style="font-size: 14px; color: #4ade80;">21 ngày</strong>
              </div>
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Tiến độ:</span> <strong style="font-size: 14px; color: #fbbf24;">100%</strong>
              </div>
            </div>
          </div>

          <!-- Table of Logs -->
          <div style="flex: 1; background: #131d31; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #0f172a; border-bottom: 1px solid #1e293b; color: #94a3b8;">
                  <th style="padding: 10px 14px; width: 120px;">Ngày</th>
                  <th style="padding: 10px 14px; width: 260px;">Báo cáo / Task</th>
                  <th style="padding: 10px 14px;">Công việc thực hiện</th>
                  <th style="padding: 10px 14px; width: 130px;">Hoạt động</th>
                  <th style="padding: 10px 14px; width: 90px; text-align: center;">Giờ</th>
                  <th style="padding: 10px 14px; width: 100px; text-align: center;">Trạng thái</th>
                </tr>
              </thead>
              <tbody style="color: #cbd5e1;">
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">30/10 (Thứ 6)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">Báo cáo tiến độ Sprint 44</span></td>
                  <td style="padding: 10px 14px;">Review PR #89, fix bug giao diện & update tài liệu hướng dẫn</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #4ade80;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Đã log</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b; background: rgba(56, 189, 248, 0.03);">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">29/10 (Thứ 5)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">Chức năng xuất báo cáo</span></td>
                  <td style="padding: 10px 14px;">Thiết kế API xuất dữ liệu CSV/Excel & tích hợp giao diện</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #4ade80;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Đã log</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">28/10 (Thứ 4)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">Tối ưu hóa hiệu năng DB</span></td>
                  <td style="padding: 10px 14px;">Index bảng comments, tối ưu query thời gian thực</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #38bdf8;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Sẵn sàng</span></td>
                </tr>
              </tbody>
            </table>
            
            <!-- Bottom bulk action -->
            <div style="margin-top: auto; padding: 12px 16px; background: #0f172a; border-top: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 12px; color: #94a3b8;">Gán nhanh Activity:</span>
                <span style="background: #1e293b; border: 1px solid #334155; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9;">Development</span>
                <button style="background: #3e5ba3; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Áp dụng cho các dòng sẵn sàng</button>
              </div>
              <button style="background: #10b981; color: #fff; border: none; padding: 7px 18px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">Ghi Time Hàng Loạt</button>
            </div>
          </div>
        </div>
      `,
    },
    en: {
      badge: "Time Tracking • Redmine Monthly Worklog",
      title: "Redmine Monthly Worklog & Automated Time Tracking",
      subtitle:
        "Automatic monthly task aggregation, duplicate detection, exact hour calculation, and 1-click bulk activity logging.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Top Toolbar: Month Picker & Summary Stats -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #131d31; padding: 12px 16px; border-radius: 10px; border: 1px solid #1e293b;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 700; font-size: 15px; color: #f1f5f9;">Monthly Report:</span>
              <div style="display: inline-flex; align-items: center; background: #0f172a; padding: 3px; border: 1px solid #334155; border-radius: 8px; gap: 4px;">
                <button style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                </button>
                <input type="text" value="October 2026" readonly style="height: 28px; padding: 2px 12px; border: 1px solid #334155; border-radius: 6px; background: #1e293b; color: #f1f5f9; font-size: 13px; font-weight: 600; width: 130px; text-align: center;">
                <button style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </button>
                <button style="height: 28px; padding: 0 10px; background: #1e293b; border: 1px solid #334155; color: #9bb4f5; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer;">This Month</button>
              </div>
            </div>

            <!-- Stats -->
            <div style="display: flex; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Total Hours:</span> <strong style="font-size: 14px; color: #38bdf8;">168.0h</strong>
              </div>
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Work Days:</span> <strong style="font-size: 14px; color: #4ade80;">21 days</strong>
              </div>
              <div style="background: #0f172a; border: 1px solid #1e293b; padding: 6px 14px; border-radius: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Progress:</span> <strong style="font-size: 14px; color: #fbbf24;">100%</strong>
              </div>
            </div>
          </div>

          <!-- Table of Logs -->
          <div style="flex: 1; background: #131d31; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #0f172a; border-bottom: 1px solid #1e293b; color: #94a3b8;">
                  <th style="padding: 10px 14px; width: 120px;">Date</th>
                  <th style="padding: 10px 14px; width: 260px;">Report / Task</th>
                  <th style="padding: 10px 14px;">Completed Work</th>
                  <th style="padding: 10px 14px; width: 130px;">Activity</th>
                  <th style="padding: 10px 14px; width: 90px; text-align: center;">Hours</th>
                  <th style="padding: 10px 14px; width: 100px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody style="color: #cbd5e1;">
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">Oct 30 (Fri)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">Sprint 44 Progress Report</span></td>
                  <td style="padding: 10px 14px;">Review PR #89, fix UI layout bugs & update guide docs</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #4ade80;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Logged</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b; background: rgba(56, 189, 248, 0.03);">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">Oct 29 (Thu)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">Export Report Feature</span></td>
                  <td style="padding: 10px 14px;">Design CSV/Excel export API & integrate UI controls</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #4ade80;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Logged</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">Oct 28 (Wed)</td>
                  <td style="padding: 10px 14px;"><span style="color: #38bdf8; font-weight: 500;">DB Performance Optimization</span></td>
                  <td style="padding: 10px 14px;">Index comments table & optimize real-time query</td>
                  <td style="padding: 10px 14px;"><span style="background: #0f172a; border: 1px solid #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Development</span></td>
                  <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #38bdf8;">8.0h</td>
                  <td style="padding: 10px 14px; text-align: center;"><span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Ready</span></td>
                </tr>
              </tbody>
            </table>
            
            <!-- Bottom bulk action -->
            <div style="margin-top: auto; padding: 12px 16px; background: #0f172a; border-top: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 12px; color: #94a3b8;">Bulk Activity:</span>
                <span style="background: #1e293b; border: 1px solid #334155; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9;">Development</span>
                <button style="background: #3e5ba3; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Apply to ready rows</button>
              </div>
              <button style="background: #10b981; color: #fff; border: none; padding: 7px 18px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">Log Selected Entries</button>
            </div>
          </div>
        </div>
      `,
    },
  },

  // 3. Quick Control Popup & Connection Health
  {
    name: "03_quick_popup",
    url: "chrome-extension://b2r/popup.html",
    vi: {
      badge: "B2R Extension UI • Popup Kiểm Soát Nhanh",
      title: "Popup điều khiển nhanh & Trạng thái kết nối",
      subtitle:
        "Tự động kiểm tra sức khỏe API Redmine, Backlog và AI theo thời gian thực; truy cập nhanh báo cáo tháng và các dự án active.",
      content: `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
          <!-- Floating Centered Popup -->
          <div style="width: 380px; background: #131d31; border: 1px solid #243247; border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;">
            <!-- Popup Header -->
            <div style="padding: 16px; background: #1a263d; border-bottom: 1px solid #243247; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #0f172a; border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                </div>
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">Backlog2Redmine</div>
                  <div style="font-size: 11px; color: #94a3b8;">Phiên bản v1.8.24 (Mới nhất)</div>
                </div>
              </div>
              <span style="font-size: 11px; background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600;">Sẵn sàng</span>
            </div>

            <!-- Health Status Rows -->
            <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">Backlog API</span>
                <span style="font-size: 11px; color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">● Đã kết nối</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">Redmine API</span>
                <span style="font-size: 11px; color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">● Đã kết nối</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">Dịch vụ AI (Gemini 2.5)</span>
                <span style="font-size: 11px; color: #38bdf8; display: inline-flex; align-items: center; gap: 4px;">⚡ Siêu tốc</span>
              </div>
            </div>

            <!-- Project Selector -->
            <div style="padding: 0 16px 14px;">
              <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">Dự án mặc định:</div>
              <div style="background: #0b111e; border: 1px solid #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600;">
                [B2R] Core Banking System Migration
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div style="padding: 12px 16px; background: #0f172a; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 8px;">
              <button style="width: 100%; background: #3e5ba3; color: #fff; border: none; padding: 9px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                <span>Báo cáo log time tháng 10/2026</span>
              </button>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 7px; border-radius: 6px; font-size: 12px; cursor: pointer;">Mở Redmine</button>
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 7px; border-radius: 6px; font-size: 12px; cursor: pointer;">Mở Backlog</button>
              </div>
            </div>
          </div>
        </div>
      `,
    },
    en: {
      badge: "B2R Extension UI • Quick Control Popup",
      title: "Quick Control Popup & Real-time Health Monitor",
      subtitle:
        "Real-time API health checks for Backlog, Redmine & AI providers; 1-click access to monthly timesheets and active workspaces.",
      content: `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
          <!-- Floating Centered Popup -->
          <div style="width: 380px; background: #131d31; border: 1px solid #243247; border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;">
            <!-- Popup Header -->
            <div style="padding: 16px; background: #1a263d; border-bottom: 1px solid #243247; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #0f172a; border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                </div>
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">Backlog2Redmine</div>
                  <div style="font-size: 11px; color: #94a3b8;">Version v1.8.24 (Latest)</div>
                </div>
              </div>
              <span style="font-size: 11px; background: rgba(74,222,128,0.15); color: #4ade80; padding: 3px 8px; border-radius: 4px; font-weight: 600;">Active</span>
            </div>

            <!-- Health Status Rows -->
            <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">Backlog API</span>
                <span style="font-size: 11px; color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">● Connected</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">Redmine API</span>
                <span style="font-size: 11px; color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">● Connected</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; background: #0b111e; padding: 10px 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">AI Service (Gemini 2.5)</span>
                <span style="font-size: 11px; color: #38bdf8; display: inline-flex; align-items: center; gap: 4px;">⚡ High Speed</span>
              </div>
            </div>

            <!-- Project Selector -->
            <div style="padding: 0 16px 14px;">
              <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">Default Project:</div>
              <div style="background: #0b111e; border: 1px solid #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600;">
                [B2R] Core Banking System Migration
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div style="padding: 12px 16px; background: #0f172a; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 8px;">
              <button style="width: 100%; background: #3e5ba3; color: #fff; border: none; padding: 9px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                <span>Log Time for October 2026</span>
              </button>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 7px; border-radius: 6px; font-size: 12px; cursor: pointer;">Open Redmine</button>
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 7px; border-radius: 6px; font-size: 12px; cursor: pointer;">Open Backlog</button>
              </div>
            </div>
          </div>
        </div>
      `,
    },
  },

  // 4. 1-Click Issue Migration & Link Binding
  {
    name: "04_issue_migration",
    url: "https://workspace.backlog.com/view/PROJ-104",
    vi: {
      badge: "Chuyển Đổi Dự Án • Issue Migration",
      title: "Chuyển đổi Issue & Tự động liên kết 2 chiều",
      subtitle:
        "Tạo Issue mới trên Redmine trực tiếp từ Backlog; tự động map tiêu đề, mô tả, đính kèm file và gán Custom Fields chuẩn xác.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Top migration header -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #131d31; padding: 14px 18px; border-radius: 10px; border: 1px solid #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #3e5ba3; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">MIGRATION</span>
              <span style="font-weight: 700; font-size: 15px; color: #f1f5f9;">Tạo Issue mới trên Redmine từ Backlog</span>
            </div>
            <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">Nguồn: CTRIAL-104</span>
          </div>

          <!-- Migration Fields Grid -->
          <div style="flex: 1; background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
            <!-- Left Fields -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Dự án đích (Redmine):</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  Core Banking System [CBS]
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Loại công việc (Tracker):</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  Bug / Defect
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Tiêu đề Issue (Đã dịch sang VN):</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  [CTRIAL-104] Khắc phục lỗi vỡ layout trên giao diện xác thực 2 bước
                </div>
              </div>
            </div>

            <!-- Right Fields: Custom Fields & File Attachments -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Custom Fields Mapping:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #cbd5e1; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #94a3b8;">Backlog Issue Key:</span>
                    <strong style="color: #38bdf8;">CTRIAL-104</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #94a3b8;">Môi trường phát hiện:</span>
                    <strong style="color: #f1f5f9;">Staging (v2.4.1)</strong>
                  </div>
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Tệp đính kèm tự động chuyển đổi:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #4ade80;">
                  ✓ test_result_v2.png (340 KB) - Sẵn sàng upload
                </div>
              </div>
              <div style="margin-top: auto; display: flex; justify-content: flex-end; gap: 10px;">
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 8px 14px; border-radius: 6px; font-size: 12px;">Hủy bỏ</button>
                <button style="background: #3e5ba3; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">Tạo Issue & Liên kết</button>
              </div>
            </div>
          </div>
        </div>
      `,
    },
    en: {
      badge: "Project Migration • 1-Click Issue Linking",
      title: "1-Click Issue Migration & Two-way Link Binding",
      subtitle:
        "Create Redmine issues directly from Backlog; automatically map titles, descriptions, custom fields, and attachments with zero friction.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Top migration header -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #131d31; padding: 14px 18px; border-radius: 10px; border: 1px solid #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #3e5ba3; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">MIGRATION</span>
              <span style="font-weight: 700; font-size: 15px; color: #f1f5f9;">Create New Redmine Issue from Backlog</span>
            </div>
            <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">Source: CTRIAL-104</span>
          </div>

          <!-- Migration Fields Grid -->
          <div style="flex: 1; background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
            <!-- Left Fields -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Target Project (Redmine):</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  Core Banking System [CBS]
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Tracker Type:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  Bug / Defect
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Translated Issue Title:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #f1f5f9;">
                  [CTRIAL-104] Fix layout glitch on two-factor authentication view
                </div>
              </div>
            </div>

            <!-- Right Fields: Custom Fields & File Attachments -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Custom Fields Mapping:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #cbd5e1; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #94a3b8;">Backlog Issue Key:</span>
                    <strong style="color: #38bdf8;">CTRIAL-104</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #94a3b8;">Detected Environment:</span>
                    <strong style="color: #f1f5f9;">Staging (v2.4.1)</strong>
                  </div>
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 5px;">Attached File Migration:</label>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #4ade80;">
                  ✓ test_result_v2.png (340 KB) - Ready for upload
                </div>
              </div>
              <div style="margin-top: auto; display: flex; justify-content: flex-end; gap: 10px;">
                <button style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 8px 14px; border-radius: 6px; font-size: 12px;">Cancel</button>
                <button style="background: #3e5ba3; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(62,91,163,0.3);">Create & Link Issue</button>
              </div>
            </div>
          </div>
        </div>
      `,
    },
  },

  // 5. Multi-Provider AI & AES-GCM Encrypted Security
  {
    name: "05_multi_ai_security",
    url: "chrome-extension://b2r/options.html",
    vi: {
      badge: "Cấu hình Nâng cao • Đa AI & Bảo Mật AES-GCM",
      title: "Tùy biến đa mô hình AI & Bảo mật cấp cao",
      subtitle:
        "Hỗ trợ Gemini, Groq, Cerebras, OpenRouter với cơ chế tự động chuyển dự phòng; lưu trữ an toàn bằng mã hóa AES-256-GCM.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Security Banner -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); padding: 12px 18px; border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
              <div>
                <strong style="color: #38bdf8; font-size: 13px;">Bảo mật phần cứng AES-256-GCM</strong>
                <div style="color: #94a3b8; font-size: 11px;">Mọi API Key và Token đều được mã hóa cục bộ. Không bao giờ gửi dữ liệu bảo mật ra ngoài.</div>
              </div>
            </div>
            <span style="font-size: 11px; color: #4ade80; font-weight: 600; background: rgba(74,222,128,0.15); padding: 4px 8px; border-radius: 4px;">Đã mã hóa an toàn</span>
          </div>

          <!-- Multi-Provider Grid -->
          <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Primary AI -->
            <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #243247; padding-bottom: 10px;">
                <span style="font-weight: 700; color: #f1f5f9; font-size: 14px;">Dịch vụ AI chính (Primary)</span>
                <span style="background: #3e5ba3; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Ưu tiên</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Nhà cung cấp:</span>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 7px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600; margin-top: 4px;">
                  Google Gemini AI Studio (Flash 2.5 / Flash Lite)
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Models đã kích hoạt (Round-Robin):</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px;">✓ gemini-2.5-flash-lite</span>
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px;">✓ gemini-2.5-flash</span>
                </div>
              </div>
              <div style="margin-top: auto; background: #0b111e; padding: 8px 10px; border-radius: 6px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>API Keys đã thêm:</span>
                <strong style="color: #4ade80;">2 Keys (Tự động luân phiên)</strong>
              </div>
            </div>

            <!-- Fallback AI -->
            <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #243247; padding-bottom: 10px;">
                <span style="font-weight: 700; color: #f1f5f9; font-size: 14px;">Dịch vụ AI dự phòng (Fallback)</span>
                <span style="background: #243247; color: #cbd5e1; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Tự động</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Nhà cung cấp dự phòng:</span>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 7px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600; margin-top: 4px;">
                  Groq Cloud (Siêu tốc - Llama 3.3 70B Versatile)
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Chế độ chuyển mạch thông minh:</span>
                <div style="margin-top: 6px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                  Khi Gemini gặp rate limit (429), hệ thống tự động chuyển sang Groq trong 0.1s mà không làm gián đoạn người dùng.
                </div>
              </div>
              <div style="margin-top: auto; background: #0b111e; padding: 8px 10px; border-radius: 6px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Trạng thái dự phòng:</span>
                <strong style="color: #38bdf8;">Sẵn sàng tức thì</strong>
              </div>
            </div>
          </div>
        </div>
      `,
    },
    en: {
      badge: "Advanced Settings • Multi-AI & AES-GCM Security",
      title: "Multi-Provider AI Fallback & AES-GCM Encrypted Security",
      subtitle:
        "Native support for Gemini, Groq, Cerebras & OpenRouter with auto-failover; protected with client-side AES-256-GCM encryption.",
      content: `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 14px;">
          <!-- Security Banner -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); padding: 12px 18px; border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
              <div>
                <strong style="color: #38bdf8; font-size: 13px;">Hardware-grade AES-256-GCM Local Security</strong>
                <div style="color: #94a3b8; font-size: 11px;">All API keys and credentials are encrypted strictly on your machine. Never exposed or transmitted.</div>
              </div>
            </div>
            <span style="font-size: 11px; color: #4ade80; font-weight: 600; background: rgba(74,222,128,0.15); padding: 4px 8px; border-radius: 4px;">Secure Encrypted</span>
          </div>

          <!-- Multi-Provider Grid -->
          <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Primary AI -->
            <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #243247; padding-bottom: 10px;">
                <span style="font-weight: 700; color: #f1f5f9; font-size: 14px;">Primary AI Service</span>
                <span style="background: #3e5ba3; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Priority</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Provider:</span>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 7px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600; margin-top: 4px;">
                  Google Gemini AI Studio (Flash 2.5 / Flash Lite)
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Active Models (Round-Robin):</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px;">✓ gemini-2.5-flash-lite</span>
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px;">✓ gemini-2.5-flash</span>
                </div>
              </div>
              <div style="margin-top: auto; background: #0b111e; padding: 8px 10px; border-radius: 6px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Configured API Keys:</span>
                <strong style="color: #4ade80;">2 Keys (Auto Load-Balanced)</strong>
              </div>
            </div>

            <!-- Fallback AI -->
            <div style="background: #131d31; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #243247; padding-bottom: 10px;">
                <span style="font-weight: 700; color: #f1f5f9; font-size: 14px;">Fallback AI Service</span>
                <span style="background: #243247; color: #cbd5e1; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Failover</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Fallback Provider:</span>
                <div style="background: #0b111e; border: 1px solid #243247; padding: 7px 10px; border-radius: 6px; font-size: 12px; color: #f1f5f9; font-weight: 600; margin-top: 4px;">
                  Groq Cloud (Ultra Fast - Llama 3.3 70B Versatile)
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: #94a3b8;">Seamless Failover Protection:</span>
                <div style="margin-top: 6px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                  When Gemini hits rate limit (429), B2R automatically fails over to Groq in 0.1s without breaking the workflow.
                </div>
              </div>
              <div style="margin-top: auto; background: #0b111e; padding: 8px 10px; border-radius: 6px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Failover State:</span>
                <strong style="color: #38bdf8;">Warm Standby Ready</strong>
              </div>
            </div>
          </div>
        </div>
      `,
    },
  },
];

// Generate HTML and render PNGs
async function main() {
  console.log("Generating Chrome Web Store Screenshots (1280x800)...");

  for (let i = 0; i < screenshots.length; i++) {
    const item = screenshots[i];

    // 1. Vietnamese version
    const htmlVi = buildTemplate({
      badge: item.vi.badge,
      title: item.vi.title,
      subtitle: item.vi.subtitle,
      contentHtml: item.vi.content,
      url: item.url,
    });
    const htmlPathVi = path.resolve(`store_assets/screenshots_vi/${item.name}.html`);
    const pngPathVi = path.resolve(`store_assets/screenshots_vi/${item.name}.png`);
    fs.writeFileSync(htmlPathVi, htmlVi, "utf8");

    cp.execFileSync(chromePath, [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1280,800",
      "--screenshot=" + pngPathVi,
      "file:///" + htmlPathVi.replace(/\\\\/g, "/"),
    ]);
    console.log(
      `[VI ${i + 1}/5] Rendered: ${item.name}.png (${fs.statSync(pngPathVi).size} bytes)`
    );

    // 2. English version (All languages)
    const htmlEn = buildTemplate({
      badge: item.en.badge,
      title: item.en.title,
      subtitle: item.en.subtitle,
      contentHtml: item.en.content,
      url: item.url,
    });
    const htmlPathEn = path.resolve(`store_assets/screenshots_en/${item.name}.html`);
    const pngPathEn = path.resolve(`store_assets/screenshots_en/${item.name}.png`);
    fs.writeFileSync(htmlPathEn, htmlEn, "utf8");

    cp.execFileSync(chromePath, [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1280,800",
      "--screenshot=" + pngPathEn,
      "file:///" + htmlPathEn.replace(/\\\\/g, "/"),
    ]);
    console.log(
      `[EN ${i + 1}/5] Rendered: ${item.name}.png (${fs.statSync(pngPathEn).size} bytes)`
    );
  }

  console.log("\\nAll 10 Chrome Web Store screenshots successfully created in store_assets/!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
