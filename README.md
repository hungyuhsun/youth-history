# 青年高中校史影片（1971–2026）

以 SVG 動畫製作的校史影片，可直接在瀏覽器播放：
**https://hungyuhsun.github.io/youth-history/**

- 操作：空白鍵 播放/暫停、← → 上/下一則、F 全螢幕；控制列可開關口白與背景音樂。
- 資料來源：青年高中校史沿革試算表；背景音樂為本校校歌鋼琴曲。

## 修改內容

| 想改的東西 | 檔案 |
|---|---|
| 校史文字、口白稿、章節 | `data.js` |
| 插畫圖示 | `icons.js` |
| 動畫與播放 | `app.js` |

修改口白稿（`data.js` 的 `say` 欄位）後，重新產生語音：

```bash
python tools/build_narration.py
```

本機預覽：直接以瀏覽器開啟 `index.html`。
