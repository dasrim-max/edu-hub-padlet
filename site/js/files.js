// 모아보드 교사 화면의 파일: 올리기·보기·지우기. 저장소를 아는 곳은 이 파일 하나뿐이에요.
//   새 파일: 쌤허브 공통 파일 모듈(/shared/files.js, 경로 moaboard/<교사>/<보드>/<학생 또는 t>/<id>.<확장자>)
//   예전 파일(전환 기간에만): moaboard-files 버킷, 경로 <교사>/<보드>/<학생 또는 t>/<id>.<확장자>
//   예전 파일을 모두 새 저장소로 옮기면 아래 LEGACY 부분을 지워요. R2 로 옮길 때는 이 파일을 고치지 않아요(공통 모듈이 맡음).
import { uploadAsTeacher, fileUrls, removeMyFiles } from "/shared/files.js";
import { SLUG } from "./common.js";

/** 새 경로인지(첫 칸이 moaboard). 새·예전 경로를 가르는 판단은 여기 하나뿐 */
export const isHubPath = (p) => typeof p === "string" && p.startsWith(`${SLUG}/`);

/** 배경 사진은 크게 보여 주니 긴 쪽 1920px, 글 사진은 공통 기본값(1600px) */
export const BG_SHRINK = { max: 1920 };

const LEGACY_BUCKET = "moaboard-files";   // LEGACY
const KEEP_MS = 50 * 60 * 1000;

export function createFiles(hub) {
  const legacyCache = new Map();   // LEGACY: 경로 → { url, at }

  return {
    /** 올리기: { path, name, size, kind, url(이 기기의 미리보기) } */
    async upload(file, { boardId, kind, shrink } = {}) {
      const up = await uploadAsTeacher(hub, { appSlug: SLUG, contentId: boardId, file, kind, shrink });
      return { ...up, url: up.previewUrl };
    },

    /** 보기 주소(1시간짜리, 50분 동안 다시 씀). 경로 → 주소 함수를 돌려줘요. 못 받은 경로는 null */
    async urls(paths) {
      const list = [...new Set((paths || []).filter(Boolean))];
      const hubPaths = list.filter(isHubPath), legacy = list.filter((p) => !isHubPath(p));
      const out = new Map();
      if (hubPaths.length) {
        try { for (const [p, u] of await fileUrls(hub, hubPaths)) out.set(p, u); }
        catch (e) { console.error("moaboard files:", e); }   // 사진만 안 보이고 보드는 그대로 보이게
      }
      if (legacy.length) {   // LEGACY
        const now = Date.now(), need = legacy.filter((p) => !(now - (legacyCache.get(p)?.at ?? 0) < KEEP_MS));
        if (need.length) {
          const { data } = await hub.sb.storage.from(LEGACY_BUCKET).createSignedUrls(need, 3600);
          for (const u of data ?? []) if (u.signedUrl) legacyCache.set(u.path, { url: u.signedUrl, at: now });
        }
        for (const p of legacy) if (legacyCache.has(p)) out.set(p, legacyCache.get(p).url);
      }
      return (p) => (p ? out.get(p) ?? null : null);
    },

    /** 보드를 지울 때: 이 보드로 올라간 공통 모듈 파일을 모두(글에 붙이지 않고 남은 것까지) 지워요 */
    async removeBoard(boardId) {
      const { data, error } = await hub.sb.from("hub_files").select("path").eq("app_slug", SLUG).eq("content_id", boardId).limit(5000);
      if (error) throw error;
      await this.remove((data ?? []).map((r) => r.path));
    },

    /** 지우기(글·배경·보드를 지울 때). 200개씩 */
    async remove(paths) {
      const list = [...new Set((paths || []).filter(Boolean))];
      const hubPaths = list.filter(isHubPath), legacy = list.filter((p) => !isHubPath(p));
      for (let i = 0; i < hubPaths.length; i += 200) await removeMyFiles(hub, hubPaths.slice(i, i + 200));
      if (legacy.length) {   // LEGACY: 학생 파일도 교사 폴더(<교사 id>/…) 아래라 교사가 지울 수 있어요
        for (let i = 0; i < legacy.length; i += 200) await hub.sb.storage.from(LEGACY_BUCKET).remove(legacy.slice(i, i + 200));
        legacy.forEach((p) => legacyCache.delete(p));
      }
    },
  };
}
